import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { AiQuestion } from '../types/idea';

interface QuestionWizardCardProps {
  questions: AiQuestion[];
  disabled?: boolean;
  onSubmitAll: (qaPairs: Array<{ question: string; answer: string }>) => void;
}

export const QuestionWizardCard: React.FC<QuestionWizardCardProps> = ({
  questions,
  disabled,
  onSubmitAll,
}) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) return null;

  const current = questions[step];
  const currentAnswer = answers[current.id] ?? '';
  const isLast = step === questions.length - 1;

  const setAnswerForCurrent = (val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [current.id]: val,
    }));
  };

  const handleFinish = () => {
    const pairs = questions.map((q) => ({
      question: q.question,
      answer: (answers[q.id] ?? '').trim() || 'No preference',
    }));
    setSubmitted(true);
    onSubmitAll(pairs);
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/8 p-2.5 text-[11px] text-emerald-300">
        Submitted {questions.length} answers to curate your build &amp; files.
      </div>
    );
  }

  return (
    <div
      data-testid="ai-question-wizard"
      className="rounded-xl border border-[#E5A93C]/45 bg-[#151A25] p-3 text-xs shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between text-[10px] text-[#8E98AB]">
        <span className="font-semibold text-[#E5A93C]">
          Question {step + 1} of {questions.length}
        </span>
        <span className="font-mono tabular-nums">
          {Object.values(answers).filter((a) => a.trim()).length}/{questions.length} answered
        </span>
      </div>

      <p className="mb-2.5 text-xs font-medium leading-snug text-[#F3F5F8]">
        {current.question}
      </p>

      {current.options.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {current.options.map((opt) => {
            const selected = currentAnswer === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswerForCurrent(opt)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                  selected
                    ? 'border-[#E5A93C] bg-[#E5A93C]/18 text-[#F7DFAA]'
                    : 'border-[#272E3E] bg-[#0E1219] text-[#C4CCD9] hover:border-[#3A445A] hover:text-[#F3F5F8]'
                }`}
              >
                {selected && <Check className="h-3 w-3 text-[#E5A93C]" />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <label htmlFor={`wizard-answer-${current.id}`} className="sr-only">
          Type your own answer
        </label>
        <input
          id={`wizard-answer-${current.id}`}
          type="text"
          value={currentAnswer}
          onChange={(e) => setAnswerForCurrent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!isLast) {
                setStep((s) => s + 1);
              } else if (!disabled) {
                handleFinish();
              }
            }
          }}
          placeholder="Or type your own answer..."
          className="w-full rounded-lg border border-[#262D3D] bg-[#0B0D10] px-2.5 py-1.5 text-[11px] text-[#E6E9EF] placeholder-[#5B6579] focus:border-[#E5A93C] focus:outline-none"
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#222836] pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#9BA4B5] hover:text-[#F3F5F8] disabled:opacity-40"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back</span>
        </button>

        {!isLast ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
            className="inline-flex items-center gap-1 rounded-md bg-[#232A38] px-2.5 py-1 text-[11px] font-medium text-[#F3F5F8] hover:bg-[#2E3749]"
          >
            <span>Next</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={handleFinish}
            className="inline-flex items-center gap-1 rounded-md bg-[#E5A93C] px-3 py-1 text-[11px] font-semibold text-[#0B0D10] hover:bg-[#EEB955] disabled:opacity-45"
          >
            <span>Curate &amp; Generate</span>
            <Check className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};
