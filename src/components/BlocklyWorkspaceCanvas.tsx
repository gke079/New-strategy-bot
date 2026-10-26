import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { SYNTHETIC_MARKETS } from '../services/markets';
import { XmlBotStage } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, RefreshCw, Upload } from 'lucide-react';

interface BlocklyWorkspaceCanvasProps {
  xmlText: string;
  onXmlEdited: (newXml: string) => void;
  onImportXmlFileContent: (xmlContent: string, fileName?: string) => void;
  activeStage: XmlBotStage;
  theme?: 'dark' | 'light';
}

let derivBlocksRegistered = false;

function registerDerivDbotBlocks() {
  if (derivBlocksRegistered) return;
  derivBlocksRegistered = true;

  const symbolOptions: [string, string][] = SYNTHETIC_MARKETS.map((m) => [
    `${m.name} (${m.symbol})`,
    m.id,
  ]);

  const jsonBlocks = [
    // 1. TRADE PARAMETERS ROOT & SUB-BLOCKS
    {
      type: 'trade_definition',
      message0: '1. Trade Parameters %1 Market & Contract %2 Initialization %3 Trade Options %4',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'TRADE_OPTIONS' },
        { type: 'input_statement', name: 'INITIALIZATION' },
        { type: 'input_statement', name: 'SUBMARKET' },
      ],
      colour: '#0284c7',
      tooltip: 'Deriv DBot Stage 1: Define market, contract type, variables, stake, and duration.',
    },
    {
      type: 'trade_definition_market',
      message0: 'Market: %1 > %2 > %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'MARKET_LIST',
          options: [
            ['Derived / Synthetic', 'synthetic_index'],
            ['Forex', 'forex'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'SUBMARKET_LIST',
          options: [
            ['Continuous Indices', 'random_index'],
            ['Daily Reset / 1s Indices', 'random_daily'],
            ['Step Indices', 'step_index'],
            ['Jump Indices', 'jump_index'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'SYMBOL_LIST',
          options: symbolOptions,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
      tooltip: 'Select synthetic market symbol.',
    },
    {
      type: 'trade_definition_tradetype',
      message0: 'Trade Type: %1 > %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TRADETYPECAT_LIST',
          options: [
            ['Digits', 'digits'],
            ['Up / Down', 'callput'],
            ['In / Out & Runs', 'upsanddowns'],
            ['Reset', 'reset'],
          ],
        },
        {
          type: 'field_dropdown',
          name: 'TRADETYPE_LIST',
          options: [
            ['Over / Under', 'overunder'],
            ['Matches / Differs', 'matchesdiffers'],
            ['Even / Odd', 'evenodd'],
            ['Rise / Fall', 'risefall'],
            ['Only Ups / Only Downs', 'runs'],
            ['Reset Call / Put', 'reset'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
      tooltip: 'Select Deriv contract category and trade type.',
    },
    {
      type: 'trade_definition_contracttype',
      message0: 'Contract Direction: %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TYPE_LIST',
          options: [
            ['Both Directions', 'both'],
            ['Digit Over (DIGITOVER)', 'DIGITOVER'],
            ['Digit Under (DIGITUNDER)', 'DIGITUNDER'],
            ['Digit Differs (DIGITDIFF)', 'DIGITDIFF'],
            ['Digit Matches (DIGITMATCH)', 'DIGITMATCH'],
            ['Digit Even (DIGITEVEN)', 'DIGITEVEN'],
            ['Digit Odd (DIGITODD)', 'DIGITODD'],
            ['Rise / Call (CALL)', 'CALL'],
            ['Fall / Put (PUT)', 'PUT'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
    },
    {
      type: 'trade_definition_candleinterval',
      message0: 'Default Candle Interval: %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'CANDLEINTERVAL_LIST',
          options: [
            ['1 minute', '60'],
            ['2 minutes', '120'],
            ['5 minutes', '300'],
            ['15 minutes', '900'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
    },
    {
      type: 'trade_definition_restartbuysell',
      message0: 'Restart buy/sell on error: %1',
      args0: [{ type: 'field_checkbox', name: 'TIME_MACHINE_ENABLED', checked: false }],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
    },
    {
      type: 'trade_definition_restartonerror',
      message0: 'Restart last trade on error: %1',
      args0: [{ type: 'field_checkbox', name: 'RESTARTONERROR', checked: true }],
      previousStatement: null,
      nextStatement: null,
      colour: '#0369a1',
    },
    {
      type: 'math_number_positive',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'NUM', value: 1, min: 0 }],
      output: 'Number',
      colour: '#4f46e5',
    },

    // 2. BEFORE PURCHASE (STAGE 2)
    {
      type: 'before_purchase',
      message0: '2. Purchase Conditions (Before Purchase) %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BEFOREPURCHASE_STACK' },
      ],
      colour: '#0d9488',
      tooltip: 'Deriv DBot Stage 2: Evaluated on every incoming tick before purchasing a contract.',
    },
    {
      type: 'purchase',
      message0: 'Purchase Contract: %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PURCHASE_LIST',
          options: [
            ['Over (DIGITOVER)', 'DIGITOVER'],
            ['Under (DIGITUNDER)', 'DIGITUNDER'],
            ['Differs (DIGITDIFF)', 'DIGITDIFF'],
            ['Matches (DIGITMATCH)', 'DIGITMATCH'],
            ['Even (DIGITEVEN)', 'DIGITEVEN'],
            ['Odd (DIGITODD)', 'DIGITODD'],
            ['Rise / Call (CALL)', 'CALL'],
            ['Fall / Put (PUT)', 'PUT'],
            ['Only Ups (RUNHIGH)', 'RUNHIGH'],
            ['Only Downs (RUNLOW)', 'RUNLOW'],
            ['Reset Call (RESETCALL)', 'RESETCALL'],
            ['Reset Put (RESETPUT)', 'RESETPUT'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#059669',
      tooltip: 'Executes a contract purchase immediately when reached.',
    },

    // 3. DURING PURCHASE (STAGE 3)
    {
      type: 'during_purchase',
      message0: '3. Sell Conditions (During Purchase) %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DURING_PURCHASE_STACK' },
      ],
      colour: '#d97706',
      tooltip: 'Deriv DBot Stage 3: Evaluated while an open multi-tick or timed contract is active.',
    },
    {
      type: 'check_sell',
      message0: 'Sell is available',
      output: 'Boolean',
      colour: '#d97706',
    },
    {
      type: 'sell_profit_loss',
      message0: 'Sell profit / loss ($)',
      output: 'Number',
      colour: '#d97706',
    },
    {
      type: 'sell_at_market',
      message0: 'Sell at market',
      previousStatement: null,
      nextStatement: null,
      colour: '#b45309',
    },

    // 4. AFTER PURCHASE (STAGE 4)
    {
      type: 'after_purchase',
      message0: '4. Restart Trading Conditions (After Purchase) %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'AFTERPURCHASE_STACK' },
      ],
      colour: '#2563eb',
      tooltip: 'Deriv DBot Stage 4: Check Win/Loss outcome, adjust Martingale stake, and Trade Again.',
    },
    {
      type: 'contract_check_result',
      message0: 'Result is %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'CHECK_RESULT',
          options: [
            ['Win', 'win'],
            ['Loss', 'loss'],
          ],
        },
      ],
      output: 'Boolean',
      colour: '#2563eb',
    },
    {
      type: 'read_details',
      message0: 'Contract Detail: %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DETAIL_INDEX',
          options: [
            ['Profit', '4'],
            ['Buy Price', '2'],
            ['Payout', '3'],
            ['Exit Spot', '9'],
          ],
        },
      ],
      output: null,
      colour: '#2563eb',
    },
    {
      type: 'total_profit',
      message0: 'Total Profit ($)',
      output: 'Number',
      colour: '#2563eb',
    },
    {
      type: 'trade_again',
      message0: 'Trade Again',
      previousStatement: null,
      colour: '#1d4ed8',
      tooltip: 'Restarts trading cycle back to Stage 2 (Purchase Conditions).',
    },

    // TICK & DIGIT ANALYSIS BLOCKS
    {
      type: 'last_digit',
      message0: 'Last Digit',
      output: 'Number',
      colour: '#0891b2',
      tooltip: 'Returns the last digit (0-9) of the latest spot tick.',
    },
    {
      type: 'tick',
      message0: 'Last Tick Price',
      output: 'Number',
      colour: '#0891b2',
      tooltip: 'Returns the latest spot quote.',
    },
    {
      type: 'check_direction',
      message0: 'Direction is %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'CHECK_DIRECTION',
          options: [
            ['Rise', 'rise'],
            ['Fall', 'fall'],
          ],
        },
      ],
      output: 'Boolean',
      colour: '#0891b2',
    },
    {
      type: 'digit_streak_check',
      message0: 'Streak Condition: %1 for %2 ticks (Barrier %3)',
      args0: [
        {
          type: 'field_dropdown',
          name: 'STREAK_TYPE',
          options: [
            ['Digits Over Barrier', 'streak_over_n'],
            ['Digits Under Barrier', 'streak_under_n'],
            ['Even Digits Streak', 'streak_even_n'],
            ['Odd Digits Streak', 'streak_odd_n'],
            ['Rising Ticks Streak', 'rising_ticks_n'],
            ['Falling Ticks Streak', 'falling_ticks_n'],
          ],
        },
        { type: 'field_number', name: 'STREAK_COUNT', value: 3, min: 1, max: 20 },
        { type: 'field_number', name: 'BARRIER_DIGIT', value: 4, min: 0, max: 9 },
      ],
      output: 'Boolean',
      colour: '#0891b2',
    },
    {
      type: 'notify',
      message0: 'Notify %1 : %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'NOTIFICATION_TYPE',
          options: [
            ['Success / Green', 'success'],
            ['Info / Blue', 'info'],
            ['Warn / Amber', 'warn'],
            ['Error / Red', 'error'],
          ],
        },
        { type: 'input_value', name: 'MESSAGE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: '#6366f1',
    },
  ];

  Blockly.defineBlocksWithJsonArray(jsonBlocks);

  // Special block with optional PREDICTION input and Deriv XML <mutation> compatibility
  Blockly.Blocks['trade_definition_tradeoptions'] = {
    init: function (this: Blockly.Block & { hasPrediction_?: boolean }) {
      this.hasPrediction_ = true;
      this.appendDummyInput()
        .appendField('Duration Unit:')
        .appendField(
          new Blockly.FieldDropdown([
            ['Ticks (t)', 't'],
            ['Seconds (s)', 's'],
            ['Minutes (m)', 'm'],
          ]),
          'DURATIONTYPE_LIST'
        );
      this.appendValueInput('DURATION').setCheck('Number').appendField('Duration:');
      this.appendValueInput('AMOUNT').setCheck('Number').appendField('Stake ($):');
      this.appendValueInput('PREDICTION').setCheck('Number').appendField('Prediction / Barrier (0-9):');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#0284c7');
      this.setInputsInline(false);
    },
    mutationToDom: function (this: Blockly.Block & { hasPrediction_?: boolean }) {
      const container = Blockly.utils.xml.createElement('mutation');
      container.setAttribute('has_first_barrier', 'false');
      container.setAttribute('has_second_barrier', 'false');
      container.setAttribute('has_prediction', this.hasPrediction_ !== false ? 'true' : 'false');
      return container;
    },
    domToMutation: function (this: Blockly.Block & { hasPrediction_?: boolean }, xmlElement: Element) {
      const hasPred = xmlElement.getAttribute('has_prediction');
      this.hasPrediction_ = hasPred !== 'false';
    },
  };
}

/**
 * Dynamically registers any unrecognized <block> or <shadow> types present in an imported
 * third-party Deriv DBot .xml file so Blockly never fails to render external blocks.
 */
function ensureUnknownXmlBlocksRegistered(dom: Element) {
  const nodes = [
    ...Array.from(dom.getElementsByTagName('block')),
    ...Array.from(dom.getElementsByTagName('shadow')),
  ];

  for (const el of nodes) {
    const type = el.getAttribute('type');
    if (!type || Blockly.Blocks[type]) continue;

    const parentTag = el.parentElement?.tagName.toLowerCase();
    const isOutput = parentTag === 'value';
    const childFields = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'field');
    const childValues = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'value');
    const childStatements = Array.from(el.children).filter(
      (c) => c.tagName.toLowerCase() === 'statement'
    );

    const fieldNames = childFields.map((f) => ({
      name: f.getAttribute('name') || 'FIELD',
      defaultVal: f.textContent || '',
    }));
    const valueNames = childValues.map((v) => v.getAttribute('name') || 'VAL');
    const statementNames = childStatements.map((s) => s.getAttribute('name') || 'DO');
    const niceLabel = type.replace(/_/g, ' ');

    Blockly.Blocks[type] = {
      init: function (this: Blockly.Block) {
        const header = this.appendDummyInput().appendField(niceLabel);
        for (const fn of fieldNames) {
          header.appendField(`${fn.name}:`).appendField(new Blockly.FieldTextInput(fn.defaultVal), fn.name);
        }
        for (const vn of valueNames) {
          this.appendValueInput(vn).appendField(vn);
        }
        for (const sn of statementNames) {
          this.appendStatementInput(sn).appendField(sn);
        }
        if (isOutput) {
          this.setOutput(true, null);
        } else {
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
        }
        this.setColour('#475569');
      },
      mutationToDom: function () {
        return Blockly.utils.xml.createElement('mutation');
      },
      domToMutation: function () {
        // Accept any external mutation attributes gracefully
      },
    };
  }
}

const DBOT_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '1. Trade Params',
      colour: '#0284c7',
      contents: [
        { kind: 'block', type: 'trade_definition_market' },
        { kind: 'block', type: 'trade_definition_tradetype' },
        { kind: 'block', type: 'trade_definition_contracttype' },
        { kind: 'block', type: 'trade_definition_tradeoptions' },
      ],
    },
    {
      kind: 'category',
      name: '2. Purchase',
      colour: '#0d9488',
      contents: [
        { kind: 'block', type: 'before_purchase' },
        { kind: 'block', type: 'purchase' },
      ],
    },
    {
      kind: 'category',
      name: '3. Sell Rules',
      colour: '#d97706',
      contents: [
        { kind: 'block', type: 'during_purchase' },
        { kind: 'block', type: 'check_sell' },
        { kind: 'block', type: 'sell_profit_loss' },
        { kind: 'block', type: 'sell_at_market' },
      ],
    },
    {
      kind: 'category',
      name: '4. After Purchase',
      colour: '#2563eb',
      contents: [
        { kind: 'block', type: 'after_purchase' },
        { kind: 'block', type: 'contract_check_result' },
        { kind: 'block', type: 'total_profit' },
        { kind: 'block', type: 'read_details' },
        { kind: 'block', type: 'trade_again' },
      ],
    },
    {
      kind: 'category',
      name: 'Tick & Digits',
      colour: '#0891b2',
      contents: [
        { kind: 'block', type: 'last_digit' },
        { kind: 'block', type: 'tick' },
        { kind: 'block', type: 'check_direction' },
        { kind: 'block', type: 'digit_streak_check' },
        { kind: 'block', type: 'notify' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      colour: '#0ea5e9',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '#6366f1',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_number_property' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: '#ec4899',
      custom: 'VARIABLE',
    },
  ],
};

export const BlocklyWorkspaceCanvas: React.FC<BlocklyWorkspaceCanvasProps> = ({
  xmlText,
  onXmlEdited,
  onImportXmlFileContent,
  activeStage,
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isProgrammaticLoadRef = useRef<boolean>(false);
  const lastLoadedXmlRef = useRef<string>('');
  const onXmlEditedRef = useRef(onXmlEdited);
  onXmlEditedRef.current = onXmlEdited;

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  // Initialize Blockly workspace
  useEffect(() => {
    if (!containerRef.current) return;
    registerDerivDbotBlocks();

    const isLight = theme === 'light';
    const customTheme = Blockly.Theme.defineTheme(isLight ? 'dbot_light' : 'dbot_dark', {
      name: isLight ? 'dbot_light' : 'dbot_dark',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: isLight ? '#f8fafc' : '#0f172a',
        toolboxBackgroundColour: isLight ? '#eff6ff' : '#1e293b',
        toolboxForegroundColour: isLight ? '#0f172a' : '#f1f5f9',
        flyoutBackgroundColour: isLight ? '#e0f2fe' : '#1e293b',
        flyoutForegroundColour: isLight ? '#0f172a' : '#f8fafc',
        flyoutOpacity: 0.97,
        scrollbarColour: isLight ? '#94a3b8' : '#475569',
        insertionMarkerColour: '#38bdf8',
        insertionMarkerOpacity: 0.5,
      },
    });

    const workspace = Blockly.inject(containerRef.current, {
      toolbox: DBOT_TOOLBOX,
      theme: customTheme,
      renderer: 'zelos',
      trashcan: true,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      zoom: {
        controls: false,
        wheel: true,
        startScale: 0.78,
        maxScale: 1.6,
        minScale: 0.35,
        scaleSpeed: 1.15,
      },
      grid: {
        spacing: 24,
        length: 2,
        colour: isLight ? '#cbd5e1' : '#334155',
        snap: true,
      },
    });

    workspaceRef.current = workspace;

    // Load initial XML
    try {
      isProgrammaticLoadRef.current = true;
      const dom = Blockly.utils.xml.textToDom(xmlText);
      ensureUnknownXmlBlocksRegistered(dom);
      Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
      lastLoadedXmlRef.current = xmlText;
      setCanvasError(null);
    } catch (err: any) {
      setCanvasError(err?.message || 'Unable to render XML blocks on canvas.');
    } finally {
      setTimeout(() => {
        isProgrammaticLoadRef.current = false;
      }, 80);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const changeListener = (event: Blockly.Events.Abstract) => {
      if (isProgrammaticLoadRef.current) return;
      if (event.isUiEvent) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!workspaceRef.current || isProgrammaticLoadRef.current) return;
        try {
          const dom = Blockly.Xml.workspaceToDom(workspaceRef.current);
          dom.setAttribute('is_dbot', 'true');
          dom.setAttribute('collection', 'false');
          const serialized = Blockly.Xml.domToPrettyText(dom);
          lastLoadedXmlRef.current = serialized;
          onXmlEditedRef.current(serialized);
        } catch {}
      }, 280);
    };

    workspace.addChangeListener(changeListener);

    const resizeObserver = new ResizeObserver(() => {
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      resizeObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [theme]);

  // Sync external XML updates (from file import, template selection, or Structured Builder)
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !xmlText) return;
    if (xmlText === lastLoadedXmlRef.current) return;

    try {
      isProgrammaticLoadRef.current = true;
      const dom = Blockly.utils.xml.textToDom(xmlText);
      ensureUnknownXmlBlocksRegistered(dom);
      Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
      lastLoadedXmlRef.current = xmlText;
      setCanvasError(null);
    } catch (err: any) {
      setCanvasError(err?.message || 'Could not load XML onto Blockly workspace.');
    } finally {
      setTimeout(() => {
        isProgrammaticLoadRef.current = false;
      }, 80);
    }
  }, [xmlText]);

  const handleZoom = (delta: number) => {
    workspaceRef.current?.zoomCenter(delta);
  };

  const handleFitWorkspace = () => {
    workspaceRef.current?.zoomToFit();
  };

  const handleUndo = () => {
    workspaceRef.current?.undo(false);
  };

  const handleRedo = () => {
    workspaceRef.current?.undo(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportXmlFileContent(reader.result, file.name);
      }
    };
    reader.readAsText(file);
  };

  const stageLabelMap: Record<XmlBotStage, string> = {
    idle: 'Workspace Ready',
    initialization: 'Stage 1: Initializing Parameters',
    before_purchase: 'Stage 2: Evaluating Purchase Conditions',
    during_purchase: 'Stage 3: Monitoring Active Contract',
    after_purchase: 'Stage 4: Processing Result & Stake',
  };

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-slate-700/80 overflow-hidden bg-[#0f172a]"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
    >
      {/* Top Canvas Utility Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-700/80 bg-[#111827]">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-sky-500">Deriv DBot Blockly Workspace</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{stageLabelMap[activeStage]}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            title="Undo block edit"
            className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            type="button"
            onClick={handleRedo}
            title="Redo block edit"
            className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1)}
            title="Zoom in"
            className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-1)}
            title="Zoom out"
            className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitWorkspace}
            title="Fit all blocks in view"
            className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {canvasError && (
        <div className="px-3.5 py-2 bg-rose-50 text-rose-700 border-b border-rose-200 text-xs flex items-center justify-between gap-2">
          <span>{canvasError}</span>
          <button
            type="button"
            onClick={() => setCanvasError(null)}
            className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Blockly Mount Surface */}
      <div
        ref={containerRef}
        className="w-full h-[560px] sm:h-[620px] blockly-dbot-surface"
      />

      {/* Drag & Drop XML Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-20 bg-sky-900/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#00FFFF] rounded-2xl pointer-events-none">
          <Upload className="w-10 h-10 text-[#00FFFF]" />
          <p className="text-base font-bold text-sky-50">Drop Deriv .xml Bot File to Load Blocks</p>
          <p className="text-xs text-sky-200">Supports Deriv DBot & Binary Bot XML strategies</p>
        </div>
      )}

      <div className="px-3.5 py-2 border-t border-slate-700/80 bg-[#111827] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Tip: Drag blocks from the left categories or drop any Deriv .xml file directly onto the canvas.</span>
        <span className="flex items-center gap-1 text-sky-500 font-medium">
          <RefreshCw className="w-3 h-3" />
          Auto-synced with Structured Builder & Live Engine
        </span>
      </div>
    </div>
  );
};
