import {
  DataFreshness,
  MarketSnapshot,
  RiskAssessment,
  RiskRuleEvaluation,
  RiskStatus,
} from '../types/index.js';
import { TokenMintAccountInfo } from '../connectors/solanaRpc.js';

export interface RiskInput {
  address: string;
  symbol: string;
  liquidityUsd: number;
  volume24hUsd: number;
  priceUsd: number;
  pairCreatedAt?: number; // UTC ms
  mintInfo?: TokenMintAccountInfo;
  snapshots?: MarketSnapshot[];
  freshness: DataFreshness;
}

export class RiskEngine {
  private static readonly RULE_VERSION = 'SENTINEL_RISK_v2.1';

  public static evaluate(input: RiskInput): RiskAssessment {
    const now = Date.now();
    const missingData: string[] = [];
    const evaluations: RiskRuleEvaluation[] = [];

    // Check Data Freshness & Critical Availability
    if (input.freshness === 'ERROR') {
      return {
        tokenAddress: input.address,
        status: 'ERROR',
        score: 75,
        level: 'UNKNOWN',
        evaluations: [
          {
            ruleId: 'DATA_SOURCE_INTEGRITY',
            name: 'فحص تكامل مصادر البيانات',
            passed: false,
            severity: 'CRITICAL',
            description: 'تعذر الاتصال بمصادر البيانات الحية لقراءة مقاييس السوق',
            evidence: 'Data freshness state is ERROR',
          },
        ],
        missingData: ['live_orderbook', 'liquidity_state', 'mint_account_info'],
        evaluatedAt: now,
        ruleVersion: RiskEngine.RULE_VERSION,
        summary: 'خطأ تقني في جلب البيانات: تم تعليق التأهيل حتى استعادة الاتصال بالمصدر الخارجي.',
      };
    }

    if (input.freshness === 'UNAVAILABLE' || input.freshness === 'UNKNOWN') {
      return {
        tokenAddress: input.address,
        status: 'UNKNOWN',
        score: 65,
        level: 'UNKNOWN',
        evaluations: [
          {
            ruleId: 'DATA_AVAILABILITY_CHECK',
            name: 'فحص توافر البيانات الأساسية',
            passed: false,
            severity: 'HIGH',
            description: 'بيانات السوق الحيوية غير مكتملة أو غير مؤكدة',
            evidence: `Data freshness status: ${input.freshness}`,
          },
        ],
        missingData: ['market_liquidity_depth', 'token_decimals'],
        evaluatedAt: now,
        ruleVersion: RiskEngine.RULE_VERSION,
        summary: 'حالة غير معروفة: نقص البيانات المتاحة يمنع إصدار حكم أمان مؤكد.',
      };
    }

    // 1. Liquidity Depth Check
    let liquidityPassed = false;
    let liquiditySev: RiskRuleEvaluation['severity'] = 'INFO';
    let liquidityEvidence = '';
    if (input.liquidityUsd < 5000) {
      liquidityPassed = false;
      liquiditySev = 'CRITICAL';
      liquidityEvidence = `السيولة الحالية ($${input.liquidityUsd.toLocaleString()}) أقل من الحد الأدنى الحرج ($5,000)`;
    } else if (input.liquidityUsd < 20000) {
      liquidityPassed = false;
      liquiditySev = 'HIGH';
      liquidityEvidence = `السيولة الحالية ($${input.liquidityUsd.toLocaleString()}) متوسطة ومنخفضة تحت حاجز الأمان الأولي ($20,000)`;
    } else {
      liquidityPassed = true;
      liquiditySev = 'INFO';
      liquidityEvidence = `السيولة متينة ($${input.liquidityUsd.toLocaleString()}) تتجاوز متطلبات الأمان`;
    }
    evaluations.push({
      ruleId: 'LIQUIDITY_DEPTH',
      name: 'عمق السيولة وحجم حوض التداول',
      passed: liquidityPassed,
      severity: liquiditySev,
      description: 'التحقق من كفاية السيولة لتجنب الانزلاق السعري العنيف ومخاطر استنزاف الحوض',
      evidence: liquidityEvidence,
    });

    // 2. Solana Mint Authority Check (Inflation / Rugpull Risk)
    let mintPassed = false;
    let mintSev: RiskRuleEvaluation['severity'] = 'INFO';
    let mintEvidence = '';
    if (!input.mintInfo || input.mintInfo.rawStatus !== 'SUCCESS') {
      missingData.push('mint_authority_verification');
      mintPassed = false;
      mintSev = 'HIGH';
      mintEvidence = 'تعذر التحقق من سلطة صك التوكن عبر Solana RPC (بيانات غير مؤكدة)';
    } else if (input.mintInfo.mintAuthority !== null) {
      mintPassed = false;
      mintSev = 'CRITICAL';
      mintEvidence = `سلطة الصك (Mint Authority) مفعلة وقابلة للزيادة لعنوان: ${input.mintInfo.mintAuthority.slice(0, 8)}...`;
    } else {
      mintPassed = true;
      mintEvidence = 'سلطة الصك ملغاة بالكامل (Mint Authority = null / Revoked)';
    }
    evaluations.push({
      ruleId: 'MINT_AUTHORITY_REVOCATION',
      name: 'إلغاء سلطة صك التوكن (Mint Revoked)',
      passed: mintPassed,
      severity: mintSev,
      description: 'إذا لم تكن سلطة الصك ملغاة، يمكن لمنشئ التوكن طباعة كميات غير محدودة وإغراق السوق',
      evidence: mintEvidence,
    });

    // 3. Solana Freeze Authority Check (Blacklist / Honeypot Risk)
    let freezePassed = false;
    let freezeSev: RiskRuleEvaluation['severity'] = 'INFO';
    let freezeEvidence = '';
    if (!input.mintInfo || input.mintInfo.rawStatus !== 'SUCCESS') {
      missingData.push('freeze_authority_verification');
      freezePassed = false;
      freezeSev = 'HIGH';
      freezeEvidence = 'تعذر فحص سلطة التجميد عبر Solana RPC';
    } else if (input.mintInfo.freezeAuthority !== null) {
      freezePassed = false;
      freezeSev = 'CRITICAL';
      freezeEvidence = `سلطة التجميد (Freeze Authority) مفعلة لعنوان: ${input.mintInfo.freezeAuthority.slice(0, 8)}...`;
    } else {
      freezePassed = true;
      freezeEvidence = 'سلطة التجميد ملغاة تماماً (Freeze Authority = null / Revoked)';
    }
    evaluations.push({
      ruleId: 'FREEZE_AUTHORITY_REVOCATION',
      name: 'إلغاء سلطة تجميد الحسابات (Freeze Revoked)',
      passed: freezePassed,
      severity: freezeSev,
      description: 'وجود سلطة التجميد يتيح للمطور منع المشترين من بيع التوكن (مصيدة Honeypot)',
      evidence: freezeEvidence,
    });

    // 4. Pair Age & Longevity Check
    let agePassed = false;
    let ageSev: RiskRuleEvaluation['severity'] = 'INFO';
    let ageEvidence = '';
    if (!input.pairCreatedAt) {
      missingData.push('pair_created_at');
      agePassed = false;
      ageSev = 'MEDIUM';
      ageEvidence = 'تاريخ إنشاء زوج التداول غير محدد';
    } else {
      const ageHours = (now - input.pairCreatedAt) / (1000 * 3600);
      if (ageHours < 1) {
        agePassed = false;
        ageSev = 'HIGH';
        ageEvidence = `عمر الزوج حديث للغاية (${Math.round(ageHours * 60)} دقيقة)، مخاطر التذبذب الأولي مرتفعة جداً`;
      } else if (ageHours < 12) {
        agePassed = false;
        ageSev = 'MEDIUM';
        ageEvidence = `عمر الزوج يبلغ ${ageHours.toFixed(1)} ساعة (مرحلة مراقبة ابتدائية)`;
      } else {
        agePassed = true;
        ageEvidence = `الزوج مستقر زمنياً بعمر ${ageHours.toFixed(1)} ساعة`;
      }
    }
    evaluations.push({
      ruleId: 'PAIR_AGE_STABILITY',
      name: 'استقرار عمر زوج التداول',
      passed: agePassed,
      severity: ageSev,
      description: 'الأزواج الأحدث من ساعة واحدة تحمل أعلى نسبة مخاطر احتيال وسحب سيولة مفاجئ',
      evidence: ageEvidence,
    });

    // 5. Liquidity Drain / Pull Anomaly
    let drainPassed = true;
    let drainEvidence = 'لم يُرصد سحب غير طبيعي للسيولة خلال السجلات المحفوظة';
    if (input.snapshots && input.snapshots.length >= 2) {
      const latest = input.snapshots[input.snapshots.length - 1];
      const prev = input.snapshots[input.snapshots.length - 2];
      if (prev.liquidityUsd > 10000 && latest.liquidityUsd < prev.liquidityUsd * 0.65) {
        drainPassed = false;
        drainEvidence = `انخفاض حاد في السيولة من $${prev.liquidityUsd.toLocaleString()} إلى $${latest.liquidityUsd.toLocaleString()} (-${Math.round((1 - latest.liquidityUsd / prev.liquidityUsd) * 100)}%)`;
      }
    }
    evaluations.push({
      ruleId: 'LIQUIDITY_DRAIN_DETECTION',
      name: 'مراقبة سحب السيولة المفاجئ',
      passed: drainPassed,
      severity: drainPassed ? 'INFO' : 'CRITICAL',
      description: 'مقارنة اللقطات الزمنية السابقة لرصد أي نزيف مفاجئ في احتياطي المجمع',
      evidence: drainEvidence,
    });

    // Compute Overall Risk Score & Status
    let score = 15; // baseline safe score
    const criticalFailures = evaluations.filter(e => !e.passed && e.severity === 'CRITICAL');
    const highFailures = evaluations.filter(e => !e.passed && e.severity === 'HIGH');
    const mediumFailures = evaluations.filter(e => !e.passed && e.severity === 'MEDIUM');

    score += criticalFailures.length * 35;
    score += highFailures.length * 20;
    score += mediumFailures.length * 10;
    if (missingData.length > 0) {
      score += missingData.length * 12;
    }
    score = Math.min(100, Math.max(0, score));

    let status: RiskStatus = 'PASS';
    let level: RiskAssessment['level'] = 'LOW';
    let summary = '';

    if (criticalFailures.length > 0) {
      status = 'BLOCKED';
      level = 'EXTREME';
      summary = `محظور (BLOCKED): تم رصد مخالفات أمنية حرجة (${criticalFailures.map(c => c.name).join('، ')}). التداول غير مسموح.`;
    } else if (missingData.some(m => m === 'market_liquidity_depth' || m === 'token_decimals')) {
      status = 'UNKNOWN';
      level = 'UNKNOWN';
      summary = `غير مؤكد (UNKNOWN): هناك نقص في بيانات السوق الأساسية (${missingData.join(', ')}). لا يمكن تصنيف التوكن قبل توفر السيولة والحجم.`;
    } else if (highFailures.length > 0 || score > 45 || missingData.length > 0) {
      status = 'REVIEW';
      level = score > 60 ? 'HIGH' : 'MEDIUM';
      summary = missingData.length > 0
        ? `قيد المراجعة (REVIEW): مؤشرات السوق مستقرة، وفحص الصلاحيات المعمقة قيد الاستكمال (${missingData.join(', ')}).`
        : `قيد المراجعة (REVIEW): مؤشرات مخاطر متوسطة تتطلب متابعة مستمرة.`;
    } else {
      status = 'PASS';
      level = score < 25 ? 'LOW' : 'MEDIUM';
      summary = `مؤهل أمنياً (PASS): اجتاز جميع اختبارات الأمان والسيولة والصلاحيات بنجاح.`;
    }

    return {
      tokenAddress: input.address,
      status,
      score,
      level,
      evaluations,
      missingData,
      evaluatedAt: now,
      ruleVersion: RiskEngine.RULE_VERSION,
      summary,
    };
  }
}
