import React, { useMemo } from 'react'
import type { YojMessage } from '../../../types/context'
import { Collapsible } from '../../../components/common/Collapsible'
import { CollapsedGroupCard } from '../../../components/context/CollapsedGroupCard'
import { ExecGutter } from '../../exec/public'
import { computeLaneTimeline, computeExecBranchAdjacency, formatUsd, getMessageKey, getExecId } from '../utils/yojUtils'
import { extractMarker, parseJsonLikeWithRemainder, splitAtFirstMarker } from '../utils/markers'
import styles from './YojMessageList.module.css'

// CSS classes used for theming (see YojMessageList.module.css):
// - Container/layout: yojList, row, contentFlex, branchWrap, preText, cardBodyStack, nestedStack, contentStack
// - Message bubble variants: bubble, bubbleUser, bubbleSystem, bubbleAssistant
// - Labels: label, labelUser, labelSystem, labelAssistant
// - Tool-calls: toolCallsBox, toolCallsTitle, toolCallsList, toolCallItem, toolCallName, toolCallPre
// - Meta footer: meta

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

function renderNestedBranch(args: {
  text: string
  sessionId?: string
  idToken?: string
  keyBase: string
  depth?: number
}): React.ReactNode {
  const { text, sessionId, idToken, keyBase, depth = 0 } = args
  if (!text || text.trim().length === 0) return null

  const split = splitAtFirstMarker(text)
  if (!split) {
    return (
      <pre key={`${keyBase}:text:${depth}`} className={styles.preText}>
        {text}
      </pre>
    )
  }

  const beforeNode = split.before && split.before.trim().length > 0 ? (
    <pre key={`${keyBase}:before:${depth}`} className={styles.preText}>
      {split.before}
    </pre>
  ) : null

  const nested = (
    <CollapsedGroupCard
      key={`${keyBase}:card:${depth}`}
      sessionId={sessionId}
      idToken={idToken}
      label={split.marker.label}
      description={split.marker.description}
      responseId={split.marker.responseId || undefined}
      defaultExpanded={split.marker.kind === 'expanded'}
    >
      {renderNestedBranch({ text: split.after, sessionId, idToken, keyBase: `${keyBase}:child`, depth: depth + 1 })}
    </CollapsedGroupCard>
  )

  return (
    <div key={`${keyBase}:wrap:${depth}`} className={styles.branchWrap}>
      {beforeNode}
      {nested}
    </div>
  )
}

export function YojMessageList(props: { messages: YojMessage[]; sessionId?: string; idToken?: string; assistantName?: string; hideExecGutter?: boolean }) {
  const { messages, sessionId, idToken, assistantName, hideExecGutter } = props

  // Dynamic lane allocation: only concurrent branches occupy multiple lanes;
  // when a branch ends, its lane is freed and reused by later branches.
  const { laneByIndex, lanesByIndex } = useMemo(() => computeLaneTimeline(messages), [messages])

  // Exec-branch adjacency: draw connectors when consecutive messages are in
  // the same exec branch (ancestor/descendant), not just the same execId.
  const { prevSame, nextSame } = useMemo(() => computeExecBranchAdjacency(messages), [messages])

  return (
    <div className={styles.yojList}>
      {messages.map((m, idx) => {
        const execId = getExecId(m as any)

        // Attempt to detect special markers at the root or embedded in content
        const rootMarker = extractMarker(m as any)
        const { parsed: parsedContent } = parseJsonLikeWithRemainder((m as any)?.content)
        const contentMarker = extractMarker(parsedContent)
        const marker = rootMarker || contentMarker

        // Lane and adjacency for gutter visualization
        const lane = laneByIndex[idx]
        const lanes = execId ? lanesByIndex[idx] : 0 // no exec → force lone dot
        const prevConn = execId ? prevSame[idx] : false
        const nextConn = execId ? nextSame[idx] : false

        if (marker) {
          const key = getMessageKey(m, idx)

          // Only render the explicit "content" value of the marker carrier.
          // Do not include outer message text before/after the marker.
          let innerText = ''
          if (rootMarker) {
            const raw = (m as any)?.content
            innerText = typeof raw === 'string' ? raw : ''
          } else if (contentMarker) {
            const raw = (parsedContent as any)?.content
            innerText = typeof raw === 'string' ? raw : ''
          }

          const toolCalls = Array.isArray((m as any)?.tool_calls) ? (m as any).tool_calls : null

          return (
            <div key={key} className={styles.row}>
              {!hideExecGutter ? (
                <ExecGutter lane={lane} lanes={lanes} showDot prevSame={prevConn} nextSame={nextConn} />
              ) : null}
              <div className={styles.contentFlex}>
                <CollapsedGroupCard
                  sessionId={sessionId}
                  idToken={idToken}
                  label={marker.label}
                  description={marker.description}
                  responseId={marker.responseId || undefined}
                  defaultExpanded={marker.kind === 'expanded'}
                >
                  {innerText || (toolCalls && toolCalls.length > 0) ? (
                    <Collapsible>
                      <div className={styles.cardBodyStack}>
                        {innerText ? (
                          <div className={styles.nestedStack}>
                            {renderNestedBranch({ text: innerText, sessionId, idToken, keyBase: `${key}:nested` })}
                          </div>
                        ) : null}

                        {toolCalls && toolCalls.length > 0 ? (
                          <div className={styles.toolCallsBox}>
                            <div className={styles.toolCallsTitle}>Tool calls</div>
                            <ul className={styles.toolCallsList}>
                              {toolCalls.map((tc: any, tIdx: number) => {
                                const fnName = tc?.function?.name ?? '(unknown)'
                                const argsRaw = tc?.function?.arguments
                                let parsed: any = argsRaw
                                try {
                                  parsed = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw
                                } catch {
                                  parsed = argsRaw
                                }
                                const prettyArgs = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
                                return (
                                  <li key={tc?.id ?? tIdx} className={styles.toolCallItem}>
                                    <div className={styles.toolCallName}>{fnName}</div>
                                    <pre className={styles.toolCallPre}>{prettyArgs}</pre>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </Collapsible>
                  ) : null}
                </CollapsedGroupCard>
              </div>
            </div>
          )
        }

        const role = (m as any)?.role ?? 'assistant'
        const rawContent: any = (m as any)?.content
        const content = typeof rawContent === 'string' && rawContent.length > 0 ? rawContent : ''
        const toolCalls = Array.isArray((m as any)?.tool_calls) ? (m as any).tool_calls : null

        const hasRenderable = (content && content.length > 0) || (toolCalls && toolCalls.length > 0)
        const fallback = !hasRenderable ? JSON.stringify(m, null, 2) : ''

        const key = getMessageKey(m, idx)

        // Footer meta: timestamp and/or cost
        const tsString = (m as any)?.create_time
          ? new Date((typeof (m as any).create_time === 'number' ? ((m as any).create_time as number) * 1000 : Date.parse(String((m as any).create_time)))).toLocaleString()
          : null
        const rawCost: any = (m as any)?.cost
        const costNum = typeof rawCost === 'string' ? parseFloat(rawCost) : rawCost
        const costString = formatUsd(costNum)
        const metaParts: string[] = []
        if (tsString) metaParts.push(tsString)
        if (costString) metaParts.push(costString)
        const metaText = metaParts.join(' · ')

        const assistantLabel = assistantName?.trim().length ? assistantName : 'Assistant'

        const bubbleVariant = role === 'user' ? styles.bubbleUser : role === 'system' ? styles.bubbleSystem : styles.bubbleAssistant
        const labelVariant = role === 'user' ? styles.labelUser : role === 'system' ? styles.labelSystem : styles.labelAssistant

        return (
          <div key={key} className={styles.row}>
            {!hideExecGutter ? (
              <ExecGutter lane={lane} lanes={lanes} showDot prevSame={prevConn} nextSame={nextConn} />
            ) : null}
            <div className={cx(styles.bubble, bubbleVariant)}>
              <div className={cx(styles.label, labelVariant)}>{role === 'assistant' ? assistantLabel : String(role).toUpperCase()}</div>

              <Collapsible>
                <div className={styles.contentStack}>
                  {content ? (
                    <div className={styles.nestedStack}>
                      {renderNestedBranch({ text: content, sessionId, idToken, keyBase: `${key}:content` })}
                    </div>
                  ) : null}

                  {toolCalls && toolCalls.length > 0 ? (
                    <div className={styles.toolCallsBox}>
                      <div className={styles.toolCallsTitle}>Tool calls</div>
                      <ul className={styles.toolCallsList}>
                        {toolCalls.map((tc: any, tIdx: number) => {
                          const fnName = tc?.function?.name ?? '(unknown)'
                          const argsRaw = tc?.function?.arguments
                          let parsed: any = argsRaw
                          try {
                            parsed = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw
                          } catch {
                            parsed = argsRaw
                          }
                          const prettyArgs = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
                          return (
                            <li key={tc?.id ?? tIdx} className={styles.toolCallItem}>
                              <div className={styles.toolCallName}>{fnName}</div>
                              <pre className={styles.toolCallPre}>{prettyArgs}</pre>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {!hasRenderable ? (
                    <pre className={styles.preText}>{fallback}</pre>
                  ) : null}
                </div>
              </Collapsible>

              {metaText ? <div className={styles.meta}>{metaText}</div> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
