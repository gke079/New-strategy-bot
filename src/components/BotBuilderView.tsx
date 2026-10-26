import React, { useState, useRef, useMemo } from 'react';
import {
  BotMetrics,
  Tick,
  Trade,
  TradeContractType,
  XmlBotConfig,
  XmlBotStage,
  XmlConditionOperator,
  XmlJournalEntry,
  XmlLossAction,
} from '../types';
import { SYNTHETIC_MARKETS } from '../services/markets';
import {
  configToDerivXml,
  DERIV_XML_TEMPLATES,
  parseDerivXmlToConfig,
} from '../services/derivXmlBridge';
import { BlocklyWorkspaceCanvas } from './BlocklyWorkspaceCanvas';
import {
  Blocks,
  Sliders,
  Code2,
  Upload,
  Download,
  Play,
  Pause,
  Square,
  RotateCcw,
  BookmarkCheck,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  ScrollText,
  History,
} from 'lucide-react';

interface BotBuilderViewProps {
  config: XmlBotConfig;
  onUpdateConfig: (next: XmlBotConfig) => void;
  isRunning: boolean;
  isPaused: boolean;
  activeStage: XmlBotStage;
  currentStake: number;
  currentStep: number;
  metrics: BotMetrics;
  trades: Trade[];
  journal: XmlJournalEntry[];
  currentTick: Tick | null;
  balance: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  theme?: 'dark' | 'light';
}

type BuilderMode = 'blockly' | 'structured' | 'xml';

export const BotBuilderView: React.FC<BotBuilderViewProps> = ({
  config,
  onUpdateConfig,
  isRunning,
  isPaused,
  activeStage,
  currentStake,
  currentStep,
  metrics,
  trades,
  journal,
  currentTick,
  balance,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  theme = 'dark',
}) => {
  const [builderMode, setBuilderMode] = useState<BuilderMode>('blockly');
  const [rawXmlDraft, setRawXmlDraft] = useState<string>(() =>
    config.rawImportedXml || configToDerivXml(config)
  );
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    details?: string[];
  } | null>(null);
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [copiedXml, setCopiedXml] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<'journal' | 'trades'>('journal');
  const [newVarName, setNewVarName] = useState<string>('');
  const [newVarVal, setNewVarVal] = useState<string>('0');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const plainVolatility = useMemo(
    () => SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility'),
    []
  );
  const volatility1s = useMemo(
    () => SYNTHETIC_MARKETS.filter((m) => m.category === 'volatility-1s'),
    []
  );
  const stepMarkets = useMemo(
    () => SYNTHETIC_MARKETS.filter((m) => m.category === 'step'),
    []
  );
  const jumpMarkets = useMemo(
    () => SYNTHETIC_MARKETS.filter((m) => m.category === 'jump'),
    []
  );

  // Sync structured field updates -> regenerate clean Deriv DBot XML
  const updateStructuredField = (patch: Partial<XmlBotConfig>) => {
    const updated: XmlBotConfig = {
      ...config,
      ...patch,
      rawImportedXml: undefined,
    };
    const nextXml = configToDerivXml(updated);
    setRawXmlDraft(nextXml);
    onUpdateConfig(updated);
  };

  // Sync edits made directly inside the Blockly drag-and-drop canvas
  const handleBlocklyXmlEdited = (editedXml: string) => {
    setRawXmlDraft(editedXml);
    try {
      const parsed = parseDerivXmlToConfig(editedXml, config.name);
      onUpdateConfig({
        ...parsed.config,
        name: config.name,
        rawImportedXml: editedXml,
      });
    } catch {
      // Keep raw XML draft if user is mid-drag with disconnected blocks
    }
  };

  // Import .xml file or raw XML text
  const handleLoadXmlString = (xmlContent: string, fileName?: string) => {
    try {
      const parsed = parseDerivXmlToConfig(xmlContent, fileName || config.name);
      setRawXmlDraft(xmlContent);
      onUpdateConfig(parsed.config);
      setImportFeedback({
        type: 'success',
        title: `Loaded "${parsed.config.name}" into Blockly Canvas & Structured Builder`,
        details: [...parsed.summary, ...parsed.warnings],
      });
    } catch (err: any) {
      setImportFeedback({
        type: 'error',
        title: err?.message || 'Failed to parse Deriv XML file.',
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleLoadXmlString(reader.result, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export .xml file compatible with Deriv DBot
  const handleExportXml = () => {
    const xmlOutput = rawXmlDraft || configToDerivXml(config);
    const blob = new Blob([xmlOutput], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (config.name || 'deriv_dbot_strategy')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '_');
    link.href = url;
    link.download = `${safeName}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectTemplate = (tplId: string) => {
    const found = DERIV_XML_TEMPLATES.find((t) => t.id === tplId);
    if (!found) return;
    const generatedXml = configToDerivXml(found.config);
    setRawXmlDraft(generatedXml);
    onUpdateConfig({ ...found.config, rawImportedXml: undefined });
    setShowTemplates(false);
    setImportFeedback({
      type: 'success',
      title: `Loaded template: ${found.name}`,
      details: [found.description],
    });
  };

  const handleSaveStrategy = () => {
    try {
      localStorage.setItem('tickedge_xml_bot_config', JSON.stringify(config));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {}
  };

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(rawXmlDraft);
      setCopiedXml(true);
      setTimeout(() => setCopiedXml(false), 1800);
    } catch {}
  };

  const handleAddCustomVariable = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) return;
    const numVal = parseFloat(newVarVal) || 0;
    const existing = config.customVariables || [];
    if (existing.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) return;
    updateStructuredField({
      customVariables: [
        ...existing,
        { id: 'var_' + Date.now().toString(36), name: trimmed, initialValue: numVal },
      ],
    });
    setNewVarName('');
    setNewVarVal('0');
  };

  const handleRemoveCustomVariable = (id: string) => {
    updateStructuredField({
      customVariables: (config.customVariables || []).filter((v) => v.id !== id),
    });
  };

  const needsBarrierDigit = ['OVER', 'UNDER', 'DIFFERS', 'MATCHES'].includes(config.contractType);
  const needsConditionDigit = [
    'last_digit_eq',
    'last_digit_neq',
    'last_digit_gt',
    'last_digit_lt',
    'streak_over_n',
    'streak_under_n',
  ].includes(config.purchaseCondition);
  const needsStreakCount = [
    'streak_over_n',
    'streak_under_n',
    'streak_even_n',
    'streak_odd_n',
    'rising_ticks_n',
    'falling_ticks_n',
  ].includes(config.purchaseCondition);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Hidden XML File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* 1. TOP BUILDER TOOLBAR & WORKSPACE SWITCHER */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Mode Switcher: Blockly Canvas vs Structured Builder vs XML Code */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sky-50 border border-sky-200 flex-wrap">
            <button
              type="button"
              onClick={() => setBuilderMode('blockly')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                builderMode === 'blockly'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-xs border border-cyan-400'
                  : 'text-sky-800 hover:bg-sky-100'
              }`}
            >
              <Blocks className="w-3.5 h-3.5" />
              <span>Blockly Canvas</span>
            </button>

            <button
              type="button"
              onClick={() => setBuilderMode('structured')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                builderMode === 'structured'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-xs border border-cyan-400'
                  : 'text-sky-800 hover:bg-sky-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Structured Builder</span>
            </button>

            <button
              type="button"
              onClick={() => setBuilderMode('xml')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                builderMode === 'xml'
                  ? 'bg-[#00FFFF] text-slate-950 font-black shadow-xs border border-cyan-400'
                  : 'text-sky-800 hover:bg-sky-100'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>XML Code</span>
            </button>
          </div>

          {/* Import / Export / Templates / Save Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sky-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import .xml</span>
            </button>

            <button
              type="button"
              onClick={handleExportXml}
              className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .xml</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTemplates((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Quick Strategies</span>
            </button>

            <button
              type="button"
              onClick={handleSaveStrategy}
              className="w-fit px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>{savedNotice ? 'Saved!' : 'Save strategy'}</span>
            </button>
          </div>
        </div>

        {/* Quick Strategy Templates Drawer */}
        {showTemplates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
            {DERIV_XML_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className="text-left p-3 rounded-xl border border-slate-700/80 hover:border-sky-400 bg-[#080d16] transition-all cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{tpl.name}</span>
                  <span className="text-[11px] text-sky-500 font-medium whitespace-nowrap">
                    {tpl.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{tpl.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Import / Parse Summary Banner */}
        {importFeedback && (
          <div
            className={`rounded-xl px-3.5 py-2.5 border text-xs flex flex-col gap-1 ${
              importFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{importFeedback.title}</span>
              <button
                type="button"
                onClick={() => setImportFeedback(null)}
                className="text-[11px] font-semibold underline cursor-pointer"
              >
                Close
              </button>
            </div>
            {importFeedback.details && importFeedback.details.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-90">
                {importFeedback.details.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. LIVE BOT EXECUTION & TELEMETRY CONTROL BAR */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
          <div>
            <span className="text-[11px] text-slate-400 block">Active XML Bot</span>
            <input
              type="text"
              value={config.name}
              onChange={(e) => updateStructuredField({ name: e.target.value })}
              className="mt-0.5 w-full px-2.5 py-1 rounded-lg bg-[#080d16] border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Market Feed</span>
            <select
              value={config.marketId}
              onChange={(e) => updateStructuredField({ marketId: e.target.value })}
              className="mt-0.5 w-full px-2 py-1 rounded-lg bg-[#080d16] border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-sky-400"
            >
              <optgroup label="Volatility Indices">
                {plainVolatility.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.symbol})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Volatility (1s) Indices">
                {volatility1s.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.symbol})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Step Indices">
                {stepMarkets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Jump Indices">
                {jumpMarkets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Live Spot / Digit</span>
            <div className="mt-1 font-mono tabular-nums text-xs font-bold text-white flex items-center gap-1.5">
              <span>{currentTick ? currentTick.quoteFormatted : '—'}</span>
              {currentTick && (
                <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-bold">
                  D:{currentTick.lastDigit}
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Current Stake · Step</span>
            <div className="mt-1 font-mono tabular-nums text-xs font-bold text-sky-400">
              ${currentStake.toFixed(2)} · Step {currentStep}/{config.maxMartingaleSteps}
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Session P/L · Win Rate</span>
            <div className="mt-1 font-mono tabular-nums text-xs font-bold flex items-center gap-2">
              <span
                className={
                  metrics.totalProfit > 0
                    ? 'text-emerald-500'
                    : metrics.totalProfit < 0
                    ? 'text-rose-500'
                    : 'text-slate-400'
                }
              >
                {metrics.totalProfit >= 0 ? '+' : ''}${metrics.totalProfit.toFixed(2)}
              </span>
              <span className="text-slate-400">
                ({metrics.wins}W/{metrics.losses}L)
              </span>
            </div>
          </div>
        </div>

        {/* Run / Pause / Stop / Compact Reset Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!isRunning ? (
            <button
              type="button"
              onClick={onStart}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-emerald-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run XML Bot</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-emerald-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={onStop}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-rose-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onReset}
            className="w-fit px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 3A. MODE 1: FULL DRAG-AND-DROP BLOCKLY CANVAS */}
      {builderMode === 'blockly' && (
        <BlocklyWorkspaceCanvas
          xmlText={rawXmlDraft}
          onXmlEdited={handleBlocklyXmlEdited}
          onImportXmlFileContent={handleLoadXmlString}
          activeStage={activeStage}
          theme={theme}
        />
      )}

      {/* 3B. MODE 2: CLEAN 4-STAGE STRUCTURED VISUAL BLOCK BUILDER */}
      {builderMode === 'structured' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* STAGE 1: TRADE PARAMETERS */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-white">01. Trade Parameters (trade_definition)</h4>
                <p className="text-xs text-slate-400">Market symbol, contract type, duration, and base stake</p>
              </div>
              <span className="text-xs font-medium text-sky-500">Stage 1</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Market Symbol</label>
                <select
                  value={config.marketId}
                  onChange={(e) => updateStructuredField({ marketId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
                >
                  {SYNTHETIC_MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Contract Type</label>
                <select
                  value={config.contractType}
                  onChange={(e) => {
                    const ct = e.target.value as TradeContractType;
                    updateStructuredField({
                      contractType: ct,
                      contractCategory: ['RISE', 'FALL', 'ONLY_UP', 'ONLY_DOWN', 'RESET_CALL', 'RESET_PUT'].includes(ct)
                        ? 'callput'
                        : 'digits',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
                >
                  <optgroup label="Digits Contracts">
                    <option value="OVER">Digit Over (DIGITOVER)</option>
                    <option value="UNDER">Digit Under (DIGITUNDER)</option>
                    <option value="DIFFERS">Digit Differs (DIGITDIFF)</option>
                    <option value="MATCHES">Digit Matches (DIGITMATCH)</option>
                    <option value="EVEN">Digit Even (DIGITEVEN)</option>
                    <option value="ODD">Digit Odd (DIGITODD)</option>
                  </optgroup>
                  <optgroup label="Up / Down & Runs">
                    <option value="RISE">Rise / Call (CALL)</option>
                    <option value="FALL">Fall / Put (PUT)</option>
                    <option value="ONLY_UP">Only Ups (RUNHIGH)</option>
                    <option value="ONLY_DOWN">Only Downs (RUNLOW)</option>
                    <option value="RESET_CALL">Reset Call (RESETCALL)</option>
                    <option value="RESET_PUT">Reset Put (RESETPUT)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Initial Stake ($)</label>
                <input
                  type="number"
                  min={0.35}
                  step={0.1}
                  value={config.initialStake}
                  onChange={(e) =>
                    updateStructuredField({ initialStake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Duration</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={config.duration}
                    onChange={(e) =>
                      updateStructuredField({ duration: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Unit</label>
                  <select
                    value={config.durationUnit}
                    onChange={(e) =>
                      updateStructuredField({ durationUnit: e.target.value as 't' | 's' | 'm' })
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
                  >
                    <option value="t">Ticks (t)</option>
                    <option value="s">Seconds (s)</option>
                    <option value="m">Minutes (m)</option>
                  </select>
                </div>
              </div>
            </div>

            {needsBarrierDigit && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  Prediction / Barrier Digit (0–9)
                </label>
                <div className="grid grid-cols-10 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => updateStructuredField({ prediction: d })}
                      className={`py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border transition-all cursor-pointer ${
                        config.prediction === d
                          ? 'bg-blue-600 text-sky-50 border-blue-500 shadow-xs'
                          : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STAGE 2: BEFORE PURCHASE CONDITIONS */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-white">02. Purchase Conditions (before_purchase)</h4>
                <p className="text-xs text-slate-400">Tick & digit filter evaluated prior to calling Purchase</p>
              </div>
              <span className="text-xs font-medium text-teal-500">Stage 2</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Entry Trigger Rule</label>
              <select
                value={config.purchaseCondition}
                onChange={(e) =>
                  updateStructuredField({ purchaseCondition: e.target.value as XmlConditionOperator })
                }
                className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
              >
                <option value="always">Immediate Purchase (Every Cycle)</option>
                <option value="last_digit_lt">When Last Digit &lt; Value</option>
                <option value="last_digit_gt">When Last Digit &gt; Value</option>
                <option value="last_digit_eq">When Last Digit == Value</option>
                <option value="last_digit_neq">When Last Digit != Value</option>
                <option value="last_digit_even">When Last Digit is Even</option>
                <option value="last_digit_odd">When Last Digit is Odd</option>
                <option value="streak_over_n">After N Consecutive Digits Over Barrier</option>
                <option value="streak_under_n">After N Consecutive Digits Under Barrier</option>
                <option value="streak_even_n">After N Consecutive Even Digits</option>
                <option value="streak_odd_n">After N Consecutive Odd Digits</option>
                <option value="rising_ticks_n">After N Consecutive Rising Ticks</option>
                <option value="falling_ticks_n">After N Consecutive Falling Ticks</option>
              </select>
            </div>

            {(needsConditionDigit || needsStreakCount) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {needsConditionDigit && (
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Target / Barrier Digit (0–9)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={config.conditionValue}
                      onChange={(e) =>
                        updateStructuredField({
                          conditionValue: Math.max(0, Math.min(9, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                    />
                  </div>
                )}

                {needsStreakCount && (
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Streak Length (N Ticks)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.conditionStreakCount}
                      onChange={(e) =>
                        updateStructuredField({
                          conditionStreakCount: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="pt-1 border-t border-slate-800/80 flex flex-col gap-2.5">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-slate-300 font-medium">
                  Alternate Contract Direction After Loss
                </span>
                <input
                  type="checkbox"
                  checked={config.alternateContractOnLoss}
                  onChange={(e) => updateStructuredField({ alternateContractOnLoss: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </label>

              {config.alternateContractOnLoss && (
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    Alternate Contract Type
                  </label>
                  <select
                    value={config.alternateContractType}
                    onChange={(e) =>
                      updateStructuredField({ alternateContractType: e.target.value as TradeContractType })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
                  >
                    <option value="UNDER">Digit Under (DIGITUNDER)</option>
                    <option value="OVER">Digit Over (DIGITOVER)</option>
                    <option value="EVEN">Digit Even (DIGITEVEN)</option>
                    <option value="ODD">Digit Odd (DIGITODD)</option>
                    <option value="DIFFERS">Digit Differs (DIGITDIFF)</option>
                    <option value="RISE">Rise (CALL)</option>
                    <option value="FALL">Fall (PUT)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* STAGE 3: DURING PURCHASE / SELL CONDITIONS */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-white">03. Sell Conditions (during_purchase)</h4>
                <p className="text-xs text-slate-400">Optional early market exit for multi-tick or timed contracts</p>
              </div>
              <span className="text-xs font-medium text-amber-500">Stage 3</span>
            </div>

            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs text-slate-300 font-medium">
                Enable Early Sell at Market Profit Lock
              </span>
              <input
                type="checkbox"
                checked={config.enableSellAtProfit}
                onChange={(e) => updateStructuredField({ enableSellAtProfit: e.target.checked })}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </label>

            {config.enableSellAtProfit && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Early Sell Profit Threshold ($)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={config.sellProfitThreshold}
                  onChange={(e) =>
                    updateStructuredField({
                      sellProfitThreshold: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                />
              </div>
            )}

            {/* Custom XML Variables Manager */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-white">XML Strategy Variables</span>
              <div className="flex flex-wrap gap-1.5">
                {(config.customVariables || []).map((v) => (
                  <div
                    key={v.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs"
                  >
                    <span className="font-semibold">{v.name}:</span>
                    <span className="font-mono tabular-nums">{v.initialValue}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomVariable(v.id)}
                      className="text-rose-600 hover:text-rose-800 cursor-pointer"
                      title="Delete variable"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Variable name"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080d16] border border-slate-700 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="0"
                  value={newVarVal}
                  onChange={(e) => setNewVarVal(e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums text-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomVariable}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* STAGE 4: AFTER PURCHASE & RISK CONTROLS */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-white">04. Restart & Recovery (after_purchase)</h4>
                <p className="text-xs text-slate-400">Martingale / D'Alembert stake logic, Take Profit, and Stop Loss</p>
              </div>
              <span className="text-xs font-medium text-blue-500">Stage 4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Stake Recovery Mode</label>
                <select
                  value={config.lossAction}
                  onChange={(e) => updateStructuredField({ lossAction: e.target.value as XmlLossAction })}
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-semibold text-white"
                >
                  <option value="martingale">Martingale (Multiply on Loss)</option>
                  <option value="dalembert">D'Alembert (Add Unit on Loss)</option>
                  <option value="compound_win">Compound (Multiply on Win)</option>
                  <option value="fixed">Fixed Stake (Flat Risk)</option>
                </select>
              </div>

              {config.lossAction === 'dalembert' ? (
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">D'Alembert Step ($)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={config.dalembertUnit}
                    onChange={(e) =>
                      updateStructuredField({ dalembertUnit: Math.max(0.1, parseFloat(e.target.value) || 0.5) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Multiplier Factor (x)</label>
                  <input
                    type="number"
                    min={1.05}
                    step={0.1}
                    value={config.martingaleMultiplier}
                    onChange={(e) =>
                      updateStructuredField({
                        martingaleMultiplier: Math.max(1.05, parseFloat(e.target.value) || 2.0),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Take Profit ($)</label>
                <input
                  type="number"
                  min={0.5}
                  step={1}
                  value={config.takeProfit}
                  onChange={(e) =>
                    updateStructuredField({ takeProfit: Math.max(0.5, parseFloat(e.target.value) || 10) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Stop Loss ($)</label>
                <input
                  type="number"
                  min={0.5}
                  step={1}
                  value={config.stopLoss}
                  onChange={(e) =>
                    updateStructuredField({ stopLoss: Math.max(0.5, parseFloat(e.target.value) || 20) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-rose-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Max Recovery Steps</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={config.maxMartingaleSteps}
                  onChange={(e) =>
                    updateStructuredField({
                      maxMartingaleSteps: Math.max(1, parseInt(e.target.value, 10) || 4),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Cooldown Ticks After Trade</label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={config.cooldownTicks}
                  onChange={(e) =>
                    updateStructuredField({
                      cooldownTicks: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#080d16] border border-slate-700 text-xs font-mono tabular-nums font-bold text-white"
                />
              </div>
            </div>

            <div className="pt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.tradeAgain}
                  onChange={(e) => updateStructuredField({ tradeAgain: e.target.checked })}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Trade Again Automatically (trade_again)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.resetOnMaxSteps}
                  onChange={(e) => updateStructuredField({ resetOnMaxSteps: e.target.checked })}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-medium">Reset Stake at Max Steps</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3C. MODE 3: RAW DERIV DBOT XML CODE INSPECTOR & PASTE */}
      {builderMode === 'xml' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white">Deriv DBot XML Source</h4>
              <p className="text-xs text-slate-400">
                Paste any Deriv DBot or Binary Bot XML below and click Apply to load it into the workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyXml}
                className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedXml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedXml ? 'Copied' : 'Copy XML'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadXmlString(rawXmlDraft, config.name)}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sky-50 text-xs font-semibold cursor-pointer"
              >
                Apply XML to Builder
              </button>
            </div>
          </div>

          <textarea
            value={rawXmlDraft}
            onChange={(e) => setRawXmlDraft(e.target.value)}
            spellCheck={false}
            className="w-full h-[440px] p-3.5 rounded-xl bg-[#080d16] border border-slate-700 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-sky-400"
          />
        </div>
      )}

      {/* 4. BOTTOM LIVE DBOT EXECUTION JOURNAL & EXECUTED TRADES */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sky-50 border border-sky-200">
            <button
              type="button"
              onClick={() => setBottomPanelTab('journal')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                bottomPanelTab === 'journal'
                  ? 'bg-[#00FFFF] text-slate-950 font-black'
                  : 'text-sky-800 hover:bg-sky-100'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>DBot Journal ({journal.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setBottomPanelTab('trades')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                bottomPanelTab === 'trades'
                  ? 'bg-[#00FFFF] text-slate-950 font-black'
                  : 'text-sky-800 hover:bg-sky-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>XML Bot Trades ({trades.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-mono tabular-nums">
              Account Balance: <strong className="text-white">${balance.toFixed(2)}</strong>
            </span>
            <button
              type="button"
              onClick={onReset}
              className="w-fit px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold cursor-pointer"
            >
              Reset History
            </button>
          </div>
        </div>

        {bottomPanelTab === 'journal' ? (
          journal.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Click <strong>Run XML Bot</strong> to stream real-time DBot block execution logs here.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
              {journal.map((entry) => (
                <div key={entry.id} className="py-2 px-2 flex items-start gap-3">
                  <span className="text-slate-500 tabular-nums shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 uppercase text-[10px] px-1.5 py-0.5 rounded border ${
                      entry.level === 'win'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : entry.level === 'loss'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : entry.level === 'buy'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : entry.level === 'warn'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {entry.level}
                  </span>
                  <span className="text-slate-200 break-words">{entry.message}</span>
                </div>
              ))}
            </div>
          )
        ) : trades.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No trades executed yet by the XML Bot Builder in this session.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2 px-2.5">Time</th>
                  <th className="py-2 px-2.5">Market</th>
                  <th className="py-2 px-2.5">Contract</th>
                  <th className="py-2 px-2.5">Exit Digit</th>
                  <th className="py-2 px-2.5 text-right">Stake</th>
                  <th className="py-2 px-2.5 text-right">Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trades.slice(0, 40).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 px-2.5 text-slate-400">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2.5 text-slate-300">{t.marketId}</td>
                    <td className="py-2 px-2.5 font-semibold text-white">{t.prediction}</td>
                    <td className="py-2 px-2.5 text-sky-400 font-bold">{t.exitDigit}</td>
                    <td className="py-2 px-2.5 text-right text-slate-300">${t.stake.toFixed(2)}</td>
                    <td
                      className={`py-2 px-2.5 text-right font-bold ${
                        t.status === 'won' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
