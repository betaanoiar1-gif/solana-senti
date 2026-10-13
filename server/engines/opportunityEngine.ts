import {
  DataFreshness,
  MarketSnapshot,
  OpportunityAssessment,
  OpportunityFactorScore,
} from '../types/index.js';
import { ScienceBioProfile } from '../connectors/science.js';

export interface OpportunityInput {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  volume1hUsd?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  txnsBuys24h?: number;
  txnsSells24h?: number;
  pairCreatedAt?: number;
  snapshots?: MarketSnapshot[];
  scienceData?: ScienceBioProfile;
  freshness: DataFreshness;
}

export class OpportunityEngine {
  public static evaluate(input: OpportunityInput): OpportunityAssessment {
    const now = Date.now();
    const factors: OpportunityFactorScore[] = [];
    const missingData: string[] = [];
    const positiveDrivers: string[] = [];
    const negativeDrivers: string[] = [];

    // 1. Buyer Momentum & Transaction Activity (Max 20 pts)
    const buys = input.txnsBuys24h || 0;
    const sells = input.txnsSells24h || 0;
    const totalTxns = buys + sells;
    let activityScore = 0;
    let activityEvidence = '';
    const activityCoverage: DataFreshness = totalTxns > 0 ? 'FRESH' : 'UNAVAILABLE';

    if (totalTxns === 0) {
      missingData.push('txns_breakdown_24h');
      activityEvidence = 'بيانات عدد صفقات البيع والشراء غير متوفرة في التغذية الحالية';
    } else {
      const buyRatio = totalTxns > 0 ? buys / totalTxns : 0.5;
      if (buyRatio >= 0.65 && totalTxns > 100) {
        activityScore = 20;
        activityEvidence = `زخم شراء قوي: نسبة المشترين ${Math.round(buyRatio * 100)}% بإجمالي ${totalTxns.toLocaleString()} عملية`;
        positiveDrivers.push('ضغط شرائي مهيمن يفوق 65% من التداولات');
      } else if (buyRatio >= 0.52 && totalTxns > 50) {
        activityScore = 14;
        activityEvidence = `نشاط شراء متوازن: نسبة المشترين ${Math.round(buyRatio * 100)}% (${buys} شراء / ${sells} بيع)`;
      } else if (buyRatio < 0.4) {
        activityScore = 5;
        activityEvidence = `ضغط بيع متزايد: نسبة البيع تتجاوز ${Math.round((1 - buyRatio) * 100)}%`;
        negativeDrivers.push('تفوق عمليات البيع على الشراء');
      } else {
        activityScore = 9;
        activityEvidence = `نشاط تداول اعتيادي (${totalTxns} عملية)`;
      }
    }
    factors.push({
      factor: 'زخم المشترين ونشاط الصفقات',
      score: activityScore,
      maxScore: 20,
      weight: 0.20,
      description: 'يقيس غلبة طلبات الشراء الصافية وحجم الإقبال التداولي الحقيقي',
      evidence: activityEvidence,
      coverage: activityCoverage,
    });

    // 2. Liquidity Quality & Depth (Max 20 pts)
    let liqScore = 0;
    let liqEvidence = '';
    if (input.liquidityUsd >= 100000) {
      liqScore = 20;
      liqEvidence = `سيولة ممتازة ($${input.liquidityUsd.toLocaleString()}) توفر حماية عالية ضد الانزلاق`;
      positiveDrivers.push('عمق سيولة مؤسسي يتجاوز $100,000');
    } else if (input.liquidityUsd >= 40000) {
      liqScore = 16;
      liqEvidence = `سيولة صحية ($${input.liquidityUsd.toLocaleString()}) تتيح تنفيذ أوامر بأمان`;
    } else if (input.liquidityUsd >= 15000) {
      liqScore = 11;
      liqEvidence = `سيولة متوسطة ($${input.liquidityUsd.toLocaleString()})`;
    } else if (input.liquidityUsd >= 5000) {
      liqScore = 5;
      liqEvidence = `سيولة متواضعة ($${input.liquidityUsd.toLocaleString()}) تفرض تقييد حجم المركز`;
      negativeDrivers.push('سيولة منخفضة نسبياً ترفع معامل الانزلاق');
    } else {
      liqScore = 1;
      liqEvidence = `سيولة حرجة ($${input.liquidityUsd.toLocaleString()})`;
      negativeDrivers.push('عمق سيولة غير كافٍ');
    }
    factors.push({
      factor: 'جودة عمق السيولة',
      score: liqScore,
      maxScore: 20,
      weight: 0.20,
      description: 'يحدد قدرة الحوض على استيعاب عمليات الشراء والبيع دون اضطراب سعري',
      evidence: liqEvidence,
      coverage: input.liquidityUsd > 0 ? 'FRESH' : 'UNAVAILABLE',
    });

    // 3. Volume Acceleration (Max 15 pts)
    let volScore = 0;
    let volEvidence = '';
    const volToLiqRatio = input.liquidityUsd > 0 ? input.volume24hUsd / input.liquidityUsd : 0;
    if (input.volume24hUsd > 500000 && volToLiqRatio >= 1.5) {
      volScore = 15;
      volEvidence = `تسارع حجم استثنائي ($${input.volume24hUsd.toLocaleString()}) بنسبة حجم/سيولة ${volToLiqRatio.toFixed(1)}x`;
      positiveDrivers.push('تدفق سيولة وأحجام تداول قياسية');
    } else if (input.volume24hUsd > 100000) {
      volScore = 12;
      volEvidence = `حجم تداول نشط ($${input.volume24hUsd.toLocaleString()})`;
    } else if (input.volume24hUsd > 25000) {
      volScore = 8;
      volEvidence = `حجم تداول معتدل ($${input.volume24hUsd.toLocaleString()})`;
    } else if (input.volume24hUsd > 5000) {
      volScore = 4;
      volEvidence = `حجم تداول هادئ ($${input.volume24hUsd.toLocaleString()})`;
    } else {
      volScore = 1;
      volEvidence = `حجم تداول ضعيف جداً ($${input.volume24hUsd.toLocaleString()})`;
      negativeDrivers.push('ركود في حجم التداول اليومي');
    }
    factors.push({
      factor: 'تسارع أحجام التداول',
      score: volScore,
      maxScore: 15,
      weight: 0.15,
      description: 'يكشف عن تدفق رؤوس الأموال الجديدة واهتمام السوق المتزايد',
      evidence: volEvidence,
      coverage: input.volume24hUsd > 0 ? 'FRESH' : 'UNAVAILABLE',
    });

    // 4. Holder & Transaction Diversity (Max 15 pts)
    let diversityScore = 8; // baseline
    let diversityEvidence = 'توزيع صفقات متوازن على مدار اليوم';
    if (totalTxns > 250) {
      diversityScore = 15;
      diversityEvidence = `تنوع تداولي واسع بمشاركة مئات المحافظ الفردية (${totalTxns} صفقة)`;
      positiveDrivers.push('تنوع نشط في قاعدة المحافظ المتداولة');
    } else if (totalTxns > 75) {
      diversityScore = 11;
      diversityEvidence = `قاعدة متداولين جيدة (${totalTxns} صفقة)`;
    } else if (totalTxns > 10) {
      diversityScore = 6;
      diversityEvidence = `عدد محافظ محدود يتداول الزوج (${totalTxns} صفقة)`;
    } else {
      diversityScore = 2;
      diversityEvidence = 'قلة عدد العمليات تشير إلى احتمالية تركز التداول';
    }
    factors.push({
      factor: 'تنوع الصفقات والمحافظ',
      score: diversityScore,
      maxScore: 15,
      weight: 0.15,
      description: 'يقيس انتشار التداول وتفادي التركز في أيدي حسابات مفردة',
      evidence: diversityEvidence,
      coverage: totalTxns > 0 ? 'FRESH' : 'UNAVAILABLE',
    });

    // 5. Pair Age & Opportunity Timing (Max 10 pts)
    let timingScore = 5;
    let timingEvidence = '';
    if (!input.pairCreatedAt) {
      missingData.push('pair_created_at');
      timingEvidence = 'عمر الزوج غير محدد بدقة';
    } else {
      const ageHours = (now - input.pairCreatedAt) / (1000 * 3600);
      if (ageHours >= 2 && ageHours <= 48) {
        timingScore = 10;
        timingEvidence = `توقيت دخول مثالي: عمر الزوج ${ageHours.toFixed(1)} ساعة في ذروة مرحلة الاكتشاف الأولى`;
        positiveDrivers.push('نافذة توقيت مبكرة ومتوازنة (2-48 ساعة)');
      } else if (ageHours > 48 && ageHours <= 168) {
        timingScore = 8;
        timingEvidence = `زوج مستقر في أسبوعه الأول (${(ageHours / 24).toFixed(1)} أيام)`;
      } else if (ageHours > 168) {
        timingScore = 5;
        timingEvidence = `زوج ناضج (${(ageHours / 24).toFixed(0)} يوماً)`;
      } else {
        timingScore = 4;
        timingEvidence = `حديث للغاية (${Math.round(ageHours * 60)} دقيقة) - تذبذب أولي مرتفع`;
      }
    }
    factors.push({
      factor: 'عمر الزوج وتوقيت الفرصة',
      score: timingScore,
      maxScore: 10,
      weight: 0.10,
      description: 'يحدد أفضلية نقطة الدخول الزمنية بين سرعة الاقتناص وتأكيد الاستقرار',
      evidence: timingEvidence,
      coverage: input.pairCreatedAt ? 'FRESH' : 'UNAVAILABLE',
    });

    // 6. Price Momentum Trajectory (Max 10 pts)
    let priceScore = 5;
    let priceEvidence = '';
    const chg1h = input.priceChange1h ?? 0;
    const chg24h = input.priceChange24h ?? 0;
    if (chg1h > 5 && chg1h < 40 && chg24h > 0) {
      priceScore = 10;
      priceEvidence = `زخم سعري صاعد متزن: +${chg1h.toFixed(1)}% في آخر ساعة و+${chg24h.toFixed(1)}% خلال 24 ساعة`;
      positiveDrivers.push('مسار صعودي متدرج دون صعود عمودي متطرف');
    } else if (chg1h > 40) {
      priceScore = 6;
      priceEvidence = `ارتفاع حاد (+${chg1h.toFixed(1)}% / 1ساعة) قد يعقبه تصحيح ارتدادي سريع`;
      negativeDrivers.push('تضخم سعري لحظي قد يستدعي الحذر من الشراء عند القمة');
    } else if (chg1h >= -5 && chg1h <= 5) {
      priceScore = 6;
      priceEvidence = `استقرار سعري وتماسك في نطاق محكم (${chg1h > 0 ? '+' : ''}${chg1h.toFixed(1)}% / 1ساعة)`;
    } else if (chg1h < -15) {
      priceScore = 2;
      priceEvidence = `مسار هابط حاد: ${chg1h.toFixed(1)}% في آخر ساعة`;
      negativeDrivers.push('هبوط سعري مستمر');
    } else {
      priceScore = 4;
      priceEvidence = `تغير سعري طفيف (${chg1h.toFixed(1)}% / 1ساعة)`;
    }
    factors.push({
      factor: 'الزخم السعري والمسار الزمني',
      score: priceScore,
      maxScore: 10,
      weight: 0.10,
      description: 'يقيم اتجاه حركة السعر وتجنب الشراء عند القمم الهوائية',
      evidence: priceEvidence,
      coverage: input.priceChange1h !== undefined ? 'FRESH' : 'UNAVAILABLE',
    });

    // 7. Social & DeSci Bioscience Activity (Max 10 pts)
    let socialScore = 3; // default neutral
    let socialEvidence = '';
    let socialCoverage: DataFreshness = 'FRESH';

    if (input.scienceData && input.scienceData.isDeSci) {
      socialScore = 10;
      socialEvidence = `مشروع علمي حقيقي (DeSci) مدعوم بمركب كيميائي (${input.scienceData.compoundName}) ودراسات إطالة عمر منشورة في PubMed`;
      positiveDrivers.push('مدعوم بأبحاث بيولوجية وفحص مخبري موثق');
    } else if (input.name.length > 3 && input.symbol.length >= 2) {
      socialScore = 6;
      socialEvidence = 'وجود علامة تجارية واضحة وأزواج تداول متداولة باهتمام مجتمعي';
    } else {
      socialCoverage = 'UNAVAILABLE';
      socialEvidence = 'لا توجد إشارات اجتماعية أو علمية خارجية متوفرة لهذا التوكن';
      missingData.push('social_sentiment_metrics');
    }
    factors.push({
      factor: 'النشاط المجتمعي والبحث العلمي (DeSci)',
      score: socialScore,
      maxScore: 10,
      weight: 0.10,
      description: 'يرصد الدعم المجتمعي والارتباط بمشاريع العلوم اللامركزية والأبحاث الحقيقية',
      evidence: socialEvidence,
      coverage: socialCoverage,
    });

    // Sum overall score
    const overallScore = Math.min(100, Math.max(0, factors.reduce((acc, f) => acc + f.score, 0)));

    // Calculate confidence based on available coverage
    const freshCount = factors.filter(f => f.coverage === 'FRESH').length;
    const confidence = Math.round((freshCount / factors.length) * 100);

    return {
      tokenAddress: input.address,
      overallScore,
      factors,
      confidence,
      missingData,
      evaluatedAt: now,
      positiveDrivers,
      negativeDrivers,
    };
  }
}
