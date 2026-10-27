import { TradeContractType, XmlBotConfig, XmlConditionOperator, XmlLossAction } from '../types';
import { SYNTHETIC_MARKETS, DEFAULT_MARKET } from './markets';

export interface DerivXmlTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  config: XmlBotConfig;
}

export const CONTRACT_TO_DERIV_CODE: Record<string, { code: string; tradeTypeCat: string; tradeType: string }> = {
  OVER: { code: 'DIGITOVER', tradeTypeCat: 'digits', tradeType: 'overunder' },
  UNDER: { code: 'DIGITUNDER', tradeTypeCat: 'digits', tradeType: 'overunder' },
  DIFFERS: { code: 'DIGITDIFF', tradeTypeCat: 'digits', tradeType: 'matchesdiffers' },
  MATCHES: { code: 'DIGITMATCH', tradeTypeCat: 'digits', tradeType: 'matchesdiffers' },
  EVEN: { code: 'DIGITEVEN', tradeTypeCat: 'digits', tradeType: 'evenodd' },
  ODD: { code: 'DIGITODD', tradeTypeCat: 'digits', tradeType: 'evenodd' },
  RISE: { code: 'CALL', tradeTypeCat: 'callput', tradeType: 'risefall' },
  FALL: { code: 'PUT', tradeTypeCat: 'callput', tradeType: 'risefall' },
  ONLY_UP: { code: 'RUNHIGH', tradeTypeCat: 'upsanddowns', tradeType: 'runs' },
  ONLY_DOWN: { code: 'RUNLOW', tradeTypeCat: 'upsanddowns', tradeType: 'runs' },
  HIGH_TICK: { code: 'TICKHIGH', tradeTypeCat: 'highlowticks', tradeType: 'highlowticks' },
  LOW_TICK: { code: 'TICKLOW', tradeTypeCat: 'highlowticks', tradeType: 'highlowticks' },
  RESET_CALL: { code: 'RESETCALL', tradeTypeCat: 'reset', tradeType: 'reset' },
  RESET_PUT: { code: 'RESETPUT', tradeTypeCat: 'reset', tradeType: 'reset' },
};

export const DERIV_CODE_TO_CONTRACT: Record<string, TradeContractType> = {
  DIGITOVER: 'OVER',
  DIGITUNDER: 'UNDER',
  DIGITDIFF: 'DIFFERS',
  DIGITMATCH: 'MATCHES',
  DIGITEVEN: 'EVEN',
  DIGITODD: 'ODD',
  CALL: 'RISE',
  CALLE: 'RISE',
  PUT: 'FALL',
  PUTE: 'FALL',
  RUNHIGH: 'ONLY_UP',
  RUNLOW: 'ONLY_DOWN',
  TICKHIGH: 'HIGH_TICK',
  TICKLOW: 'LOW_TICK',
  RESETCALL: 'RESET_CALL',
  RESETPUT: 'RESET_PUT',
};

export const DEFAULT_XML_BOT_CONFIG: XmlBotConfig = {
  id: 'dbot-default',
  name: 'Deriv DBot Over 2 Martingale',
  marketId: DEFAULT_MARKET.id,
  contractCategory: 'digits',
  contractType: 'OVER',
  prediction: 2,
  duration: 1,
  durationUnit: 't',
  initialStake: 1.0,
  purchaseCondition: 'last_digit_lt',
  conditionValue: 3,
  conditionStreakCount: 2,
  alternateContractOnLoss: false,
  alternateContractType: 'UNDER',
  enableSellAtProfit: false,
  sellProfitThreshold: 0.5,
  lossAction: 'martingale',
  martingaleMultiplier: 2.1,
  dalembertUnit: 0.5,
  maxMartingaleSteps: 4,
  resetOnMaxSteps: true,
  takeProfit: 0.1,
  stopLoss: 25.0,
  tradeAgain: true,
  cooldownTicks: 0,
  botSpeed: 'normal',
  customVariables: [
    { id: 'var_stake', name: 'Stake', initialValue: 1.0 },
    { id: 'var_init_stake', name: 'Initial Stake', initialValue: 1.0 },
    { id: 'var_martingale', name: 'Martingale Multiplier', initialValue: 2.1 },
    { id: 'var_tp', name: 'Take Profit', initialValue: 0.1 },
    { id: 'var_sl', name: 'Stop Loss', initialValue: 25.0 },
  ],
};

export const DERIV_XML_TEMPLATES: DerivXmlTemplate[] = [
  {
    id: 'tpl-over2-martingale',
    name: 'Over 2 Low-Digit Sniper',
    badge: 'Digits · Martingale',
    description: 'Waits for a last digit below 3 on Volatility 75, then purchases DIGITOVER 2 with 2.1x recovery.',
    config: {
      ...DEFAULT_XML_BOT_CONFIG,
      id: 'tpl-over2-martingale',
      name: 'Over 2 Low-Digit Sniper',
      marketId: 'R_75',
      contractCategory: 'digits',
      contractType: 'OVER',
      prediction: 2,
      purchaseCondition: 'last_digit_lt',
      conditionValue: 3,
      conditionStreakCount: 2,
      lossAction: 'martingale',
      martingaleMultiplier: 2.1,
      maxMartingaleSteps: 4,
      takeProfit: 12.0,
      stopLoss: 25.0,
    },
  },
  {
    id: 'tpl-evenodd-streak',
    name: 'Even/Odd 3-Streak Reversal',
    badge: 'Even/Odd · Streak',
    description: 'Monitors 3 consecutive Odd digits on Volatility 100 (1s) and enters DIGITEVEN with controlled 2.0x recovery.',
    config: {
      ...DEFAULT_XML_BOT_CONFIG,
      id: 'tpl-evenodd-streak',
      name: 'Even/Odd 3-Streak Reversal',
      marketId: '1HZ100V',
      contractCategory: 'digits',
      contractType: 'EVEN',
      prediction: 0,
      purchaseCondition: 'streak_odd_n',
      conditionValue: 0,
      conditionStreakCount: 3,
      alternateContractOnLoss: true,
      alternateContractType: 'ODD',
      lossAction: 'martingale',
      martingaleMultiplier: 2.0,
      maxMartingaleSteps: 5,
      takeProfit: 15.0,
      stopLoss: 30.0,
    },
  },
  {
    id: 'tpl-differs-precision',
    name: 'Differs Echo Guard',
    badge: 'Differs · High Winrate',
    description: 'Triggers DIGITDIFF 5 right when digit 5 appears, exploiting low repeat probability (~90% base win rate).',
    config: {
      ...DEFAULT_XML_BOT_CONFIG,
      id: 'tpl-differs-precision',
      name: 'Differs Echo Guard',
      marketId: '1HZ75V',
      contractCategory: 'digits',
      contractType: 'DIFFERS',
      prediction: 5,
      purchaseCondition: 'last_digit_eq',
      conditionValue: 5,
      conditionStreakCount: 1,
      lossAction: 'martingale',
      martingaleMultiplier: 11.0,
      maxMartingaleSteps: 2,
      takeProfit: 8.0,
      stopLoss: 24.0,
    },
  },
  {
    id: 'tpl-dalembert-under7',
    name: "D'Alembert Under 7 Grinder",
    badge: "Digits · D'Alembert",
    description: 'Conservative linear step recovery (+$0.50 on loss, reset on win) trading DIGITUNDER 7 after high digits.',
    config: {
      ...DEFAULT_XML_BOT_CONFIG,
      id: 'tpl-dalembert-under7',
      name: "D'Alembert Under 7 Grinder",
      marketId: 'R_50',
      contractCategory: 'digits',
      contractType: 'UNDER',
      prediction: 7,
      purchaseCondition: 'last_digit_gt',
      conditionValue: 6,
      conditionStreakCount: 2,
      lossAction: 'dalembert',
      dalembertUnit: 0.5,
      maxMartingaleSteps: 6,
      takeProfit: 10.0,
      stopLoss: 20.0,
    },
  },
  {
    id: 'tpl-risefall-momentum',
    name: 'Rise/Fall 3-Tick Momentum',
    badge: 'Rise/Fall · Trend',
    description: 'Purchases CALL (Rise) after 3 consecutive rising ticks on Volatility 25 (1s) with 2.0x recovery.',
    config: {
      ...DEFAULT_XML_BOT_CONFIG,
      id: 'tpl-risefall-momentum',
      name: 'Rise/Fall 3-Tick Momentum',
      marketId: '1HZ25V',
      contractCategory: 'callput',
      contractType: 'RISE',
      prediction: 0,
      duration: 2,
      durationUnit: 't',
      purchaseCondition: 'rising_ticks_n',
      conditionValue: 3,
      conditionStreakCount: 3,
      alternateContractOnLoss: true,
      alternateContractType: 'FALL',
      lossAction: 'martingale',
      martingaleMultiplier: 2.0,
      maxMartingaleSteps: 4,
      takeProfit: 15.0,
      stopLoss: 25.0,
    },
  },
];

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getSubmarketForSymbol(symbol: string): string {
  if (symbol.startsWith('1HZ')) return 'random_daily';
  if (symbol.startsWith('stp')) return 'step_index';
  if (symbol.startsWith('JD')) return 'jump_index';
  return 'random_index';
}

function buildBeforePurchaseConditionXml(config: XmlBotConfig, derivPurchaseCode: string): string {
  const purchaseBlock = `<block type="purchase" id="blk_purchase_main">
              <field name="PURCHASE_LIST">${derivPurchaseCode}</field>
            </block>`;

  const cond = config.purchaseCondition;
  if (cond === 'always') {
    return purchaseBlock;
  }

  let booleanCheckXml = '';
  if (
    cond === 'last_digit_eq' ||
    cond === 'last_digit_neq' ||
    cond === 'last_digit_gt' ||
    cond === 'last_digit_lt'
  ) {
    const opMap: Record<string, string> = {
      last_digit_eq: 'EQ',
      last_digit_neq: 'NEQ',
      last_digit_gt: 'GT',
      last_digit_lt: 'LT',
    };
    booleanCheckXml = `<block type="logic_compare" id="blk_cond_compare">
          <field name="OP">${opMap[cond]}</field>
          <value name="A">
            <block type="last_digit" id="blk_last_digit"></block>
          </value>
          <value name="B">
            <block type="math_number" id="blk_cond_val">
              <field name="NUM">${config.conditionValue}</field>
            </block>
          </value>
        </block>`;
  } else if (cond === 'last_digit_even' || cond === 'last_digit_odd') {
    booleanCheckXml = `<block type="math_number_property" id="blk_cond_parity">
          <mutation divisor_input="false"></mutation>
          <field name="PROPERTY">${cond === 'last_digit_even' ? 'EVEN' : 'ODD'}</field>
          <value name="NUMBER_TO_CHECK">
            <block type="last_digit" id="blk_last_digit"></block>
          </value>
        </block>`;
  } else if (cond === 'rising_ticks_n' || cond === 'falling_ticks_n') {
    booleanCheckXml = `<block type="digit_streak_check" id="blk_streak_dir">
          <field name="STREAK_TYPE">${cond}</field>
          <field name="STREAK_COUNT">${config.conditionStreakCount}</field>
          <field name="BARRIER_DIGIT">${config.conditionValue}</field>
        </block>`;
  } else {
    booleanCheckXml = `<block type="digit_streak_check" id="blk_streak_digit">
          <field name="STREAK_TYPE">${cond}</field>
          <field name="STREAK_COUNT">${config.conditionStreakCount}</field>
          <field name="BARRIER_DIGIT">${config.conditionValue}</field>
        </block>`;
  }

  return `<block type="controls_if" id="blk_before_if">
      <value name="IF0">
        ${booleanCheckXml}
      </value>
      <statement name="DO0">
        ${purchaseBlock}
      </statement>
    </block>`;
}

/**
 * Generates standard Deriv DBot-compatible Blockly XML from XmlBotConfig.
 */
export function configToDerivXml(config: XmlBotConfig): string {
  const mapping = CONTRACT_TO_DERIV_CODE[config.contractType] || CONTRACT_TO_DERIV_CODE.OVER;
  const submarket = getSubmarketForSymbol(config.marketId);
  const needsPrediction = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES', 'HIGH_TICK', 'LOW_TICK'].includes(
    config.contractType
  );

  const coreVarDefs = [
    { id: 'v_stake', name: 'Stake' },
    { id: 'v_init_stake', name: 'Initial Stake' },
    { id: 'v_martingale', name: 'Martingale' },
    { id: 'v_tp', name: 'Take Profit' },
    { id: 'v_sl', name: 'Stop Loss' },
    { id: 'v_max_steps', name: 'Max Steps' },
  ];

  const extraVars = (config.customVariables || []).filter(
    (v) => !coreVarDefs.some((cv) => cv.name.toLowerCase() === v.name.toLowerCase())
  );

  const variablesXml = [
    ...coreVarDefs.map((v) => `    <variable id="${escapeXml(v.id)}">${escapeXml(v.name)}</variable>`),
    ...extraVars.map((v) => `    <variable id="${escapeXml(v.id)}">${escapeXml(v.name)}</variable>`),
  ].join('\n');

  const predictionValueXml = needsPrediction
    ? `
          <value name="PREDICTION">
            <shadow type="math_number_positive" id="shd_pred">
              <field name="NUM">${config.prediction}</field>
            </shadow>
            <block type="math_number" id="blk_pred_val">
              <field name="NUM">${config.prediction}</field>
            </block>
          </value>`
    : '';

  const lossStakeUpdateXml =
    config.lossAction === 'martingale'
      ? `<block type="variables_set" id="blk_loss_stake">
                  <field name="VAR" id="v_stake">Stake</field>
                  <value name="VALUE">
                    <block type="math_arithmetic" id="blk_mult_stake">
                      <field name="OP">MULTIPLY</field>
                      <value name="A">
                        <block type="variables_get" id="blk_get_stake_loss">
                          <field name="VAR" id="v_stake">Stake</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="math_number" id="blk_martingale_factor">
                          <field name="NUM">${config.martingaleMultiplier}</field>
                        </block>
                      </value>
                    </block>
                  </value>
                </block>`
      : config.lossAction === 'dalembert'
      ? `<block type="variables_set" id="blk_loss_dalembert">
                  <field name="VAR" id="v_stake">Stake</field>
                  <value name="VALUE">
                    <block type="math_arithmetic" id="blk_add_stake">
                      <field name="OP">ADD</field>
                      <value name="A">
                        <block type="variables_get" id="blk_get_stake_dal">
                          <field name="VAR" id="v_stake">Stake</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="math_number" id="blk_dalembert_unit">
                          <field name="NUM">${config.dalembertUnit}</field>
                        </block>
                      </value>
                    </block>
                  </value>
                </block>`
      : `<block type="variables_set" id="blk_loss_fixed">
                  <field name="VAR" id="v_stake">Stake</field>
                  <value name="VALUE">
                    <block type="variables_get" id="blk_get_init_fixed">
                      <field name="VAR" id="v_init_stake">Initial Stake</field>
                    </block>
                  </value>
                </block>`;

  const winStakeUpdateXml =
    config.lossAction === 'compound_win'
      ? `<block type="variables_set" id="blk_win_compound">
                  <field name="VAR" id="v_stake">Stake</field>
                  <value name="VALUE">
                    <block type="math_arithmetic" id="blk_mult_win">
                      <field name="OP">MULTIPLY</field>
                      <value name="A">
                        <block type="variables_get" id="blk_get_stake_win">
                          <field name="VAR" id="v_stake">Stake</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="math_number" id="blk_compound_factor">
                          <field name="NUM">${config.martingaleMultiplier}</field>
                        </block>
                      </value>
                    </block>
                  </value>
                </block>`
      : `<block type="variables_set" id="blk_win_reset">
                  <field name="VAR" id="v_stake">Stake</field>
                  <value name="VALUE">
                    <block type="variables_get" id="blk_get_init_win">
                      <field name="VAR" id="v_init_stake">Initial Stake</field>
                    </block>
                  </value>
                </block>`;

  const duringPurchaseXml = config.enableSellAtProfit
    ? `
  <block type="during_purchase" id="during_purchase_root" x="560" y="30">
    <statement name="DURING_PURCHASE_STACK">
      <block type="controls_if" id="blk_sell_if">
        <value name="IF0">
          <block type="logic_compare" id="blk_sell_cmp">
            <field name="OP">GTE</field>
            <value name="A">
              <block type="sell_profit_loss" id="blk_sell_pl"></block>
            </value>
            <value name="B">
              <block type="math_number" id="blk_sell_thresh">
                <field name="NUM">${config.sellProfitThreshold}</field>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="sell_at_market" id="blk_sell_market"></block>
        </statement>
      </block>
    </statement>
  </block>`
    : '';

  const tradeAgainBlock = config.tradeAgain ? `<block type="trade_again" id="blk_trade_again"></block>` : '';

  return `<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false" bot_name="${escapeXml(config.name)}" alt_on_loss="${config.alternateContractOnLoss}" alt_type="${config.alternateContractType}" cooldown_ticks="${config.cooldownTicks}" reset_max="${config.resetOnMaxSteps}">
  <variables>
${variablesXml}
  </variables>
  <block type="trade_definition" id="trade_def_root" deletable="false" x="24" y="24">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="blk_td_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">${submarket}</field>
        <field name="SYMBOL_LIST">${escapeXml(config.marketId)}</field>
        <next>
          <block type="trade_definition_tradetype" id="blk_td_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">${mapping.tradeTypeCat}</field>
            <field name="TRADETYPE_LIST">${mapping.tradeType}</field>
            <next>
              <block type="trade_definition_contracttype" id="blk_td_contract" deletable="false" movable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="blk_td_candle" deletable="false" movable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuysell" id="blk_td_restart" deletable="false" movable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="blk_td_onerror" deletable="false" movable="false">
                            <field name="RESTARTONERROR">TRUE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="blk_init_stake0">
        <field name="VAR" id="v_init_stake">Initial Stake</field>
        <value name="VALUE">
          <block type="math_number" id="blk_num_init_stake">
            <field name="NUM">${config.initialStake}</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="blk_init_stake">
            <field name="VAR" id="v_stake">Stake</field>
            <value name="VALUE">
              <block type="math_number" id="blk_num_stake">
                <field name="NUM">${config.initialStake}</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="blk_init_tp">
                <field name="VAR" id="v_tp">Take Profit</field>
                <value name="VALUE">
                  <block type="math_number" id="blk_num_tp">
                    <field name="NUM">${config.takeProfit}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="blk_init_sl">
                    <field name="VAR" id="v_sl">Stop Loss</field>
                    <value name="VALUE">
                      <block type="math_number" id="blk_num_sl">
                        <field name="NUM">${config.stopLoss}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="blk_init_max_steps">
                        <field name="VAR" id="v_max_steps">Max Steps</field>
                        <value name="VALUE">
                          <block type="math_number" id="blk_num_max_steps">
                            <field name="NUM">${config.maxMartingaleSteps}</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="blk_td_options">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${needsPrediction ? 'true' : 'false'}"></mutation>
        <field name="DURATIONTYPE_LIST">${config.durationUnit}</field>
        <value name="DURATION">
          <block type="math_number" id="blk_dur_num">
            <field name="NUM">${config.duration}</field>
          </block>
        </value>
        <value name="AMOUNT">
          <block type="variables_get" id="blk_amt_var">
            <field name="VAR" id="v_stake">Stake</field>
          </block>
        </value>${predictionValueXml}
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="before_purchase_root" deletable="false" x="24" y="540">
    <statement name="BEFOREPURCHASE_STACK">
      ${buildBeforePurchaseConditionXml(config, mapping.code)}
    </statement>
  </block>${duringPurchaseXml}
  <block type="after_purchase" id="after_purchase_root" deletable="false" x="560" y="230">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="blk_after_winloss">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="blk_check_win">
            <field name="CHECK_RESULT">win</field>
          </block>
        </value>
        <statement name="DO0">
          ${winStakeUpdateXml}
        </statement>
        <statement name="ELSE">
          ${lossStakeUpdateXml}
        </statement>
        <next>
          <block type="controls_if" id="blk_check_limits">
            <value name="IF0">
              <block type="logic_operation" id="blk_limits_and">
                <field name="OP">AND</field>
                <value name="A">
                  <block type="logic_compare" id="blk_tp_cmp">
                    <field name="OP">LT</field>
                    <value name="A">
                      <block type="total_profit" id="blk_tot_prof_1"></block>
                    </value>
                    <value name="B">
                      <block type="variables_get" id="blk_get_tp">
                        <field name="VAR" id="v_tp">Take Profit</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="B">
                  <block type="logic_compare" id="blk_sl_cmp">
                    <field name="OP">GT</field>
                    <value name="A">
                      <block type="total_profit" id="blk_tot_prof_2"></block>
                    </value>
                    <value name="B">
                      <block type="math_arithmetic" id="blk_neg_sl">
                        <field name="OP">MULTIPLY</field>
                        <value name="A">
                          <block type="variables_get" id="blk_get_sl">
                            <field name="VAR" id="v_sl">Stop Loss</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number" id="blk_neg_one">
                            <field name="NUM">-1</field>
                          </block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              ${tradeAgainBlock}
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;
}

function findFirstNumberInElement(el: Element | null): number | null {
  if (!el) return null;
  const numFields = Array.from(el.getElementsByTagName('field')).filter(
    (f) => f.getAttribute('name') === 'NUM'
  );
  for (const nf of numFields) {
    const val = parseFloat(nf.textContent || '');
    if (!Number.isNaN(val)) return val;
  }
  return null;
}

/**
 * Parses any Deriv DBot / Binary Bot XML document into our unified XmlBotConfig
 * so imported .xml bots can be inspected, edited in both builders, and executed live.
 */
export function parseDerivXmlToConfig(
  xmlString: string,
  fallbackName: string = 'Imported Deriv XML Bot'
): {
  config: XmlBotConfig;
  warnings: string[];
  summary: string[];
} {
  const warnings: string[] = [];
  const summary: string[] = [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString.trim(), 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML syntax. Please select a valid Deriv DBot or Binary Bot .xml file.');
  }

  const root = doc.documentElement;
  if (!root || (root.nodeName.toLowerCase() !== 'xml' && !doc.getElementsByTagName('block').length)) {
    throw new Error('XML root does not contain Blockly <block> definitions.');
  }

  const nextConfig: XmlBotConfig = {
    ...DEFAULT_XML_BOT_CONFIG,
    id: 'xml-' + Date.now().toString(36),
    name: root.getAttribute('bot_name') || fallbackName.replace(/\.xml$/i, ''),
    rawImportedXml: xmlString,
    purchaseCondition: 'always',
  };

  if (root.getAttribute('alt_on_loss') === 'true') {
    nextConfig.alternateContractOnLoss = true;
  }
  const altTypeAttr = root.getAttribute('alt_type') as TradeContractType | null;
  if (altTypeAttr) {
    nextConfig.alternateContractType = altTypeAttr;
  }
  const cooldownAttr = parseInt(root.getAttribute('cooldown_ticks') || '0', 10);
  if (!Number.isNaN(cooldownAttr)) {
    nextConfig.cooldownTicks = cooldownAttr;
  }
  if (root.getAttribute('reset_max') === 'false') {
    nextConfig.resetOnMaxSteps = false;
  }

  // 1. Extract <variables>
  const variableNodes = Array.from(doc.getElementsByTagName('variable'));
  const varValuesByName = new Map<string, number>();

  // Scan variables_set blocks to infer initial numbers for Stake, TP, SL, Martingale, etc.
  const allBlocks = Array.from(doc.getElementsByTagName('block'));
  for (const blk of allBlocks) {
    if (blk.getAttribute('type') === 'variables_set') {
      const varField = Array.from(blk.children).find(
        (c) => c.tagName === 'field' && c.getAttribute('name') === 'VAR'
      );
      const valNode = Array.from(blk.children).find(
        (c) => c.tagName === 'value' && c.getAttribute('name') === 'VALUE'
      );
      const varName = (varField?.textContent || '').trim();
      const numVal = findFirstNumberInElement(valNode || null);
      if (varName && numVal !== null && !varValuesByName.has(varName.toLowerCase())) {
        varValuesByName.set(varName.toLowerCase(), numVal);
      }
    }
  }

  nextConfig.customVariables = variableNodes.slice(0, 20).map((vn, idx) => {
    const name = (vn.textContent || `Var_${idx + 1}`).trim();
    const id = vn.getAttribute('id') || `var_${idx}`;
    const detectedVal = varValuesByName.get(name.toLowerCase()) ?? 0;
    return { id, name, initialValue: detectedVal };
  });

  // Match well-known Deriv bot variable names (used across popular community XML bots)
  for (const [lowerName, numVal] of varValuesByName.entries()) {
    if (
      lowerName.includes('initial stake') ||
      lowerName.includes('initial amount') ||
      lowerName.includes('win stake') ||
      lowerName.includes('win amount') ||
      lowerName === 'stake'
    ) {
      if (numVal > 0) nextConfig.initialStake = numVal;
    } else if (
      lowerName.includes('take profit') ||
      lowerName.includes('target profit') ||
      lowerName.includes('expected profit')
    ) {
      if (numVal > 0) nextConfig.takeProfit = Math.abs(numVal);
    } else if (
      lowerName.includes('stop loss') ||
      lowerName.includes('max loss') ||
      lowerName.includes('acceptable loss') ||
      lowerName.includes('sl')
    ) {
      if (numVal !== 0) nextConfig.stopLoss = Math.abs(numVal);
    } else if (lowerName.includes('martingale') || lowerName.includes('multiplier')) {
      if (numVal > 0) nextConfig.martingaleMultiplier = numVal;
    } else if (lowerName.includes('max step') || lowerName.includes('max loss level')) {
      if (numVal >= 1) nextConfig.maxMartingaleSteps = Math.round(numVal);
    }
  }

  // 2. Symbol / Market extraction
  const allFields = Array.from(doc.getElementsByTagName('field'));
  const symbolField = allFields.find((f) => f.getAttribute('name') === 'SYMBOL_LIST');
  if (symbolField && symbolField.textContent) {
    const rawSym = symbolField.textContent.trim();
    const matchedMarket =
      SYNTHETIC_MARKETS.find((m) => m.id.toLowerCase() === rawSym.toLowerCase()) ||
      (rawSym === 'stpRNG' ? SYNTHETIC_MARKETS.find((m) => m.id === 'stp_index_100') : undefined);
    if (matchedMarket) {
      nextConfig.marketId = matchedMarket.id;
      summary.push(`Market: ${matchedMarket.name} (${matchedMarket.id})`);
    } else {
      warnings.push(`Symbol "${rawSym}" mapped to ${DEFAULT_MARKET.name} (${DEFAULT_MARKET.id}).`);
    }
  }

  // 3. Purchase / Contract Type extraction
  const purchaseField = allFields.find((f) => f.getAttribute('name') === 'PURCHASE_LIST');
  const typeListField = allFields.find((f) => f.getAttribute('name') === 'TYPE_LIST');
  const rawPurchaseCode = (purchaseField?.textContent || typeListField?.textContent || '').trim().toUpperCase();
  if (rawPurchaseCode && DERIV_CODE_TO_CONTRACT[rawPurchaseCode]) {
    nextConfig.contractType = DERIV_CODE_TO_CONTRACT[rawPurchaseCode];
    nextConfig.contractCategory = ['RISE', 'FALL', 'ONLY_UP', 'ONLY_DOWN', 'RESET_CALL', 'RESET_PUT'].includes(
      nextConfig.contractType
    )
      ? 'callput'
      : 'digits';
    summary.push(`Contract: ${rawPurchaseCode} (${nextConfig.contractType})`);
  }

  // 4. Trade Options: Duration, Unit, Amount, Prediction/Barrier
  const tradeOptionsBlock = allBlocks.find(
    (b) => b.getAttribute('type') === 'trade_definition_tradeoptions' || b.getAttribute('type') === 'tradeOptions'
  );
  if (tradeOptionsBlock) {
    const durUnitField = Array.from(tradeOptionsBlock.getElementsByTagName('field')).find(
      (f) => f.getAttribute('name') === 'DURATIONTYPE_LIST'
    );
    const unitText = (durUnitField?.textContent || 't').trim().toLowerCase();
    if (unitText === 't' || unitText === 's' || unitText === 'm') {
      nextConfig.durationUnit = unitText;
    }

    const valueNodes = Array.from(tradeOptionsBlock.children).filter((c) => c.tagName === 'value');
    const durNode = valueNodes.find((v) => v.getAttribute('name') === 'DURATION');
    const durNum = findFirstNumberInElement(durNode || null);
    if (durNum !== null && durNum >= 1) {
      nextConfig.duration = Math.round(durNum);
    }

    const amtNode = valueNodes.find((v) => v.getAttribute('name') === 'AMOUNT');
    const amtNum = findFirstNumberInElement(amtNode || null);
    if (amtNum !== null && amtNum > 0) {
      nextConfig.initialStake = amtNum;
    }

    const predNode = valueNodes.find(
      (v) => v.getAttribute('name') === 'PREDICTION' || v.getAttribute('name') === 'BARRIEROFFSET'
    );
    const predNum = findFirstNumberInElement(predNode || null);
    if (predNum !== null && predNum >= 0 && predNum <= 9) {
      nextConfig.prediction = Math.round(predNum);
    }
  }
  summary.push(
    `Trade Setup: $${nextConfig.initialStake.toFixed(2)} stake · ${nextConfig.duration}${nextConfig.durationUnit}${
      ['OVER', 'UNDER', 'DIFFERS', 'MATCHES', 'HIGH_TICK', 'LOW_TICK'].includes(
        nextConfig.contractType
      )
        ? ` · ${
            nextConfig.contractType === 'HIGH_TICK' || nextConfig.contractType === 'LOW_TICK'
              ? `Tick #${nextConfig.prediction}`
              : `Barrier ${nextConfig.prediction}`
          }`
        : ''
    }`
  );

  // 5. Before Purchase condition extraction
  const beforePurchaseBlock = allBlocks.find((b) => b.getAttribute('type') === 'before_purchase');
  if (beforePurchaseBlock) {
    const streakBlock = Array.from(beforePurchaseBlock.getElementsByTagName('block')).find(
      (b) => b.getAttribute('type') === 'digit_streak_check'
    );
    if (streakBlock) {
      const sType = Array.from(streakBlock.getElementsByTagName('field')).find(
        (f) => f.getAttribute('name') === 'STREAK_TYPE'
      )?.textContent as XmlConditionOperator | undefined;
      const sCount = parseInt(
        Array.from(streakBlock.getElementsByTagName('field')).find(
          (f) => f.getAttribute('name') === 'STREAK_COUNT'
        )?.textContent || '2',
        10
      );
      const bDigit = parseInt(
        Array.from(streakBlock.getElementsByTagName('field')).find(
          (f) => f.getAttribute('name') === 'BARRIER_DIGIT'
        )?.textContent || '4',
        10
      );
      if (sType) nextConfig.purchaseCondition = sType;
      if (!Number.isNaN(sCount)) nextConfig.conditionStreakCount = sCount;
      if (!Number.isNaN(bDigit)) nextConfig.conditionValue = bDigit;
    } else {
      const hasLastDigit = Array.from(beforePurchaseBlock.getElementsByTagName('block')).some(
        (b) => b.getAttribute('type') === 'last_digit'
      );
      const parityBlock = Array.from(beforePurchaseBlock.getElementsByTagName('block')).find(
        (b) => b.getAttribute('type') === 'math_number_property'
      );
      const compareBlock = Array.from(beforePurchaseBlock.getElementsByTagName('block')).find(
        (b) => b.getAttribute('type') === 'logic_compare'
      );
      const checkDirBlock = Array.from(beforePurchaseBlock.getElementsByTagName('block')).find(
        (b) => b.getAttribute('type') === 'check_direction'
      );

      if (hasLastDigit && parityBlock) {
        const prop = Array.from(parityBlock.getElementsByTagName('field')).find(
          (f) => f.getAttribute('name') === 'PROPERTY'
        )?.textContent;
        nextConfig.purchaseCondition = prop === 'ODD' ? 'last_digit_odd' : 'last_digit_even';
      } else if (hasLastDigit && compareBlock) {
        const op = Array.from(compareBlock.getElementsByTagName('field')).find(
          (f) => f.getAttribute('name') === 'OP'
        )?.textContent;
        const cmpNum = findFirstNumberInElement(compareBlock);
        if (cmpNum !== null) nextConfig.conditionValue = Math.max(0, Math.min(9, Math.round(cmpNum)));
        if (op === 'EQ') nextConfig.purchaseCondition = 'last_digit_eq';
        else if (op === 'NEQ') nextConfig.purchaseCondition = 'last_digit_neq';
        else if (op === 'GT' || op === 'GTE') nextConfig.purchaseCondition = 'last_digit_gt';
        else if (op === 'LT' || op === 'LTE') nextConfig.purchaseCondition = 'last_digit_lt';
      } else if (checkDirBlock) {
        const dir = Array.from(checkDirBlock.getElementsByTagName('field')).find(
          (f) => f.getAttribute('name') === 'CHECK_DIRECTION'
        )?.textContent;
        nextConfig.purchaseCondition = dir === 'fall' ? 'falling_ticks_n' : 'rising_ticks_n';
        nextConfig.conditionStreakCount = 2;
      }
    }
  }

  // 6. During Purchase extraction
  const duringBlock = allBlocks.find((b) => b.getAttribute('type') === 'during_purchase');
  if (duringBlock && duringBlock.getElementsByTagName('block').length > 0) {
    const hasSellMarket = Array.from(duringBlock.getElementsByTagName('block')).some(
      (b) => b.getAttribute('type') === 'sell_at_market'
    );
    if (hasSellMarket) {
      nextConfig.enableSellAtProfit = true;
      const sellThresh = findFirstNumberInElement(duringBlock);
      if (sellThresh !== null && sellThresh > 0) {
        nextConfig.sellProfitThreshold = sellThresh;
      }
    }
  }

  // 7. After Purchase recovery & trade_again extraction
  const afterBlock = allBlocks.find((b) => b.getAttribute('type') === 'after_purchase');
  if (afterBlock) {
    const hasTradeAgain = Array.from(afterBlock.getElementsByTagName('block')).some(
      (b) => b.getAttribute('type') === 'trade_again'
    );
    nextConfig.tradeAgain = hasTradeAgain;

    const arithBlocks = Array.from(afterBlock.getElementsByTagName('block')).filter(
      (b) => b.getAttribute('type') === 'math_arithmetic'
    );
    for (const ab of arithBlocks) {
      const op = Array.from(ab.getElementsByTagName('field')).find(
        (f) => f.getAttribute('name') === 'OP'
      )?.textContent;
      const num = findFirstNumberInElement(ab);
      if (op === 'MULTIPLY' && num !== null && num > 0 && num !== -1) {
        nextConfig.lossAction = 'martingale' as XmlLossAction;
        nextConfig.martingaleMultiplier = num;
      } else if (op === 'ADD' && num !== null && num > 0) {
        nextConfig.lossAction = 'dalembert' as XmlLossAction;
        nextConfig.dalembertUnit = num;
      }
    }
  }

  summary.push(
    `After Purchase: ${nextConfig.lossAction.toUpperCase()} (${
      nextConfig.lossAction === 'dalembert'
        ? `+$${nextConfig.dalembertUnit}`
        : `${nextConfig.martingaleMultiplier}x`
    }) · TP $${nextConfig.takeProfit} / SL $${nextConfig.stopLoss}`
  );

  return { config: nextConfig, warnings, summary };
}
