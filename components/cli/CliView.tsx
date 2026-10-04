'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CliEngine, CliOutputLine } from '@/lib/cli/engine';
import { Terminal, Send, HelpCircle, CornerDownLeft, Sparkles } from 'lucide-react';

export function CliView() {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lines, setLines] = useState<CliOutputLine[]>([
    {
      id: 'init_1',
      type: 'system',
      text: 'zup companion CLI shell (@zup/cli v1.0.0-edge)',
      timestamp: '00:00:00'
    },
    {
      id: 'init_2',
      type: 'output',
      text: 'Connected to local-first Dexie engine (zup_engine_v1). Type "help" or click presets below.',
      timestamp: '00:00:00'
    }
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  const handleCommand = async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun !== undefined ? cmdToRun : inputVal).trim();
    if (!rawCmd) return;

    if (rawCmd === 'clear') {
      setLines([]);
      setInputVal('');
      return;
    }

    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userLine: CliOutputLine = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'input',
      text: rawCmd,
      timestamp: now
    };

    setLines((prev) => [...prev, userLine]);
    setHistory((prev) => [...prev, rawCmd]);
    setHistoryIndex(-1);
    setInputVal('');

    const outputLines = await CliEngine.execute(rawCmd);
    setLines((prev) => [...prev, ...outputLines]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setInputVal('');
        } else {
          setHistoryIndex(nextIndex);
          setInputVal(history[nextIndex]);
        }
      }
    }
  };

  const presetCommands = [
    'zup identity list',
    'zup tail --kinds 1,30023',
    'zup relays',
    'zup telemetry',
    'zup sync --turso',
    'zup publish "Kernel 6.12 eBPF socket multiplexing validated." --sign'
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 bg-[#000000] border border-white/20 rounded-[22px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Terminal size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              @zup/cli Operator Terminal (Section 9)
            </h2>
            <p className="text-xs text-white opacity-70">
              Direct IPC shell executing headless protocol primitives against local IndexedDB tables.
            </p>
          </div>
        </div>

        {/* Quick Presets Dropdown/Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleCommand('help')}
            className="px-2.5 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-mono text-white transition-colors"
          >
            help
          </button>
          <button
            onClick={() => handleCommand('clear')}
            className="px-2.5 py-1 rounded-[10px] bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-mono text-white/70 hover:text-white transition-colors"
          >
            clear
          </button>
        </div>
      </div>

      {/* Quick Command Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-white/40 shrink-0 text-[11px]">Presets:</span>
        {presetCommands.map((preset) => (
          <button
            key={preset}
            onClick={() => handleCommand(preset)}
            className="whitespace-nowrap px-2.5 py-1 rounded-[10px] bg-[#000000] hover:bg-[#161412] border border-white/15 hover:border-indigo-400 text-white text-[11px] transition-all"
          >
            {preset.slice(0, 30)}…
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="p-5 bg-[#000000] border-2 border-white/20 rounded-[22px] shadow-2xl min-h-[460px] max-h-[580px] flex flex-col font-mono text-xs cursor-text"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-white/40 text-[11px] select-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-white font-bold">bash - zup daemon ipc</span>
          </div>
          <div>UTF-8 · Zero-Knowledge Localhost</div>
        </div>

        {/* Lines Container */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-text">
          {lines.map((line) => {
            if (line.type === 'input') {
              return (
                <div key={line.id} className="flex items-start gap-2 text-white font-bold">
                  <span className="text-emerald-400 select-none">operator@zup:~$</span>
                  <span>{line.text}</span>
                </div>
              );
            }
            if (line.type === 'system') {
              return (
                <div key={line.id} className="text-indigo-300 font-semibold py-0.5">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'success') {
              return (
                <div key={line.id} className="text-emerald-400 font-medium">
                  {line.text}
                </div>
              );
            }
            if (line.type === 'error') {
              return (
                <div key={line.id} className="text-red-400 font-medium">
                  {line.text}
                </div>
              );
            }
            return (
              <div key={line.id} className="text-white/80 whitespace-pre-wrap break-all">
                {line.text}
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>

        {/* Fixed Terminal Prompt Input */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
          <span className="text-emerald-400 font-bold select-none shrink-0">operator@zup:~$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type 'zup help' or command..."
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder-white/30"
            autoFocus
          />
          <button
            onClick={() => handleCommand()}
            className="p-1 rounded-md text-white/50 hover:text-white transition-colors"
          >
            <CornerDownLeft size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
