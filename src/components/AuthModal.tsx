import React, { useState } from 'react';
import { X, User, DollarSign, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UserAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAccount: UserAccount;
  onUpdateAccount: (account: Partial<UserAccount>) => void;
  onResetBalance: (amount: number) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  userAccount,
  onUpdateAccount,
  onResetBalance,
}) => {
  const [mode, setMode] = useState<'login' | 'profile'>('profile');
  const [username, setUsername] = useState(userAccount.username);
  const [resetAmount, setResetAmount] = useState(10000);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateAccount({ username });
    setSuccessMsg('Account details saved successfully!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleReset = (amount: number) => {
    onResetBalance(amount);
    setSuccessMsg(`Virtual balance reset to $${amount.toLocaleString()}`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00e599]/10 border border-[#00e599]/20 flex items-center justify-center text-[#00e599]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">TickEdge Account</h3>
              <p className="text-xs text-slate-400">Virtual balance & risk preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Account Card */}
          <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase">Account Type</span>
              <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => onUpdateAccount({ isDemo: true })}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    userAccount.isDemo
                      ? 'bg-emerald-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Demo ($)
                </button>
                <button
                  onClick={() => onUpdateAccount({ isDemo: false })}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    !userAccount.isDemo
                      ? 'bg-rose-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Real Live
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-400">Current Balance:</span>
              <span className="text-2xl font-mono font-bold text-white">
                ${userAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Reset Demo Balance Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#00e599]" />
              <span>Reset Virtual Demo Balance</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleReset(amt)}
                  className="py-2 px-3 rounded-xl bg-[#090d16] border border-slate-800 hover:border-[#00e599]/60 text-xs font-mono font-semibold text-slate-200 transition-all hover:bg-slate-800"
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Trader Handle</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. EdgeMaster75"
              className="w-full px-3.5 py-2 bg-[#090d16] border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-[#00e599]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#090d16] flex justify-between items-center">
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-[#00e599] hover:bg-[#00e599]/90 text-black font-bold text-xs transition-colors"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
