import { Button } from '@repo/ui/components/button'
import { useRef, useState } from 'react'
import { useAnalysisQuestions, useAskQuestion } from '../hooks/use-analysis-questions'

interface AnalysisQuestionsProps {
  analysisId: string
}

export function AnalysisQuestions({ analysisId }: AnalysisQuestionsProps) {
  const { data: questions = [] } = useAnalysisQuestions(analysisId)
  const { ask, streamingAnswer, isStreaming, error } = useAskQuestion(analysisId)
  const [input, setInput] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    setPendingQuestion(trimmed)
    await ask(trimmed)
    setPendingQuestion(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasContent = questions.length > 0 || isStreaming

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
        <QuestionIcon />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Ask about this repository</h3>
          <p className="text-xs text-muted-foreground">Get answers from the analysis context</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!hasContent && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No questions yet. Ask anything about this repository.
          </p>
        )}

        {questions.map((qa) => (
          <div key={qa.id} className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <UserIcon />
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">{qa.question}</p>
            </div>
            {qa.answer && (
              <div className="flex items-start gap-2.5 ml-1">
                <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                  <BotIcon />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {qa.answer}
                </p>
              </div>
            )}
          </div>
        ))}

        {isStreaming && pendingQuestion && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <UserIcon />
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {pendingQuestion}
              </p>
            </div>
          </div>
        )}

        {isStreaming && streamingAnswer !== null && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 ml-1">
              <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                <BotIcon />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {streamingAnswer}
                <span className="inline-block w-1 h-4 ml-0.5 bg-primary/60 animate-pulse" />
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-end gap-2 pt-2 border-t border-border/30">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            data-testid="btn-ask-send"
            className="h-9 px-4 cursor-pointer shrink-0"
          >
            {isStreaming ? (
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-1 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function QuestionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-4 h-4 text-muted-foreground shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-3 h-3 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BotIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-3 h-3 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
    </svg>
  )
}
