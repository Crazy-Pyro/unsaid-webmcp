'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Copy,
  DollarSign,
  Download,
  EyeOff,
  GitBranch,
  LockKeyhole,
  MapPin,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createDemoRoom,
  readRoom,
  roomClient,
  RoomClientError,
} from '@/src/client/room-client';
import { useWebMCPTools } from '@/src/client/webmcp';
import { PRIVATE_AGENT_BRIEF } from '@/src/shared/product';
import type {
  PublicCandidate,
  RoomPhase,
  RoomState,
  Stance,
  ToolResult,
} from '@/src/shared/types';

type ConnectionState = 'connected' | 'reconnecting' | 'offline';

const PHASE_LABELS: Record<RoomPhase, string> = {
  BRIEFING: 'Briefing',
  COLLECTING: 'Collecting',
  BRIDGING: 'Building a bridge',
  READY_TO_NOMINATE: 'Common ground ready',
  RATIFYING: 'Ratifying',
  AGREED: 'Agreed',
};

const STANCE_OPTIONS: { value: Stance; label: string; short: string }[] = [
  { value: 'preferred', label: 'Preferred', short: 'Prefer' },
  { value: 'acceptable', label: 'Can accept', short: 'Accept' },
  { value: 'unacceptable', label: 'Cannot accept', short: 'No' },
];

const ORIGINAL_POSITIONS: Record<string, { x: number; y: number }> = {
  'river-run': { x: 17, y: 25 },
  'city-studio': { x: 50, y: 16 },
  'mountain-lodge': { x: 81, y: 28 },
  'lakeside-lab': { x: 76, y: 72 },
  'museum-sprint': { x: 22, y: 73 },
};

function formatTime(value: string) {
  const [hourString, minute] = value.split(':');
  const hour = Number(hourString);
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  const clockHour = hour % 12 || 12;
  return `${clockHour}:${minute} ${suffix}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function RoomApp({ slug }: { slug: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [connection, setConnection] =
    useState<ConnectionState>('connected');
  const mounted = useRef(true);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await readRoom(slug, signal);
      if (mounted.current) {
        setState(next);
        setConnection('connected');
      }
      return next;
    },
    [slug],
  );

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void refresh(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setLoadError(
          error instanceof Error ? error.message : 'This room could not be loaded.',
        );
      }
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [refresh]);

  const phase = state?.room.phase;

  useEffect(() => {
    if (!phase || phase === 'AGREED') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const controller = new AbortController();

    const schedule = (delay: number) => {
      timer = setTimeout(poll, delay);
    };
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === 'hidden') {
        schedule(1500);
        return;
      }
      try {
        await refresh(controller.signal);
        failures = 0;
        schedule(1500);
      } catch {
        if (controller.signal.aborted) return;
        failures += 1;
        setConnection(failures > 2 ? 'offline' : 'reconnecting');
        schedule(Math.min(15000, 1500 * 2 ** failures));
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    schedule(1500);
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, refresh]);

  if (loadError) {
    return <RoomRecovery message={loadError} />;
  }
  if (!state) {
    return (
      <main className="room-loading" aria-busy="true">
        <div className="wordmark">UNSAID</div>
        <div className="loading-ring" aria-hidden="true" />
        <p>Preparing a private-context boundary and shared decision field…</p>
      </main>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <RoomExperience
        slug={slug}
        state={state}
        refresh={refresh}
        connection={connection}
      />
    </MotionConfig>
  );
}

function RoomRecovery({ message }: { message: string }) {
  const [starting, setStarting] = useState(false);

  async function restart() {
    setStarting(true);
    try {
      const room = await createDemoRoom();
      window.location.assign(`/room/${encodeURIComponent(room.room_slug)}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <main className="recovery-shell">
      <div className="wordmark">UNSAID</div>
      <CircleAlert aria-hidden="true" />
      <h1>This room needs a fresh start.</h1>
      <p>{message}</p>
      <Button onClick={restart} disabled={starting} size="lg">
        {starting ? 'Creating room…' : 'Start a fresh judge demo'}
      </Button>
    </main>
  );
}

type ExperienceProps = {
  slug: string;
  state: RoomState;
  refresh: (signal?: AbortSignal) => Promise<RoomState>;
  connection: ConnectionState;
};

type RunAction = (
  label: string,
  action: () => Promise<ToolResult>,
) => Promise<RoomState | null>;

function RoomExperience({ slug, state, refresh, connection }: ExperienceProps) {
  const [selectedId, setSelectedId] = useState(
    () => state.candidates.find((candidate) => candidate.id === 'museum-sprint')?.id,
  );
  const [panelMode, setPanelMode] = useState<'guide' | 'manual'>('guide');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [webmcpDetected, setWebmcpDetected] = useState<boolean | null>(null);
  const [registeredTools, setRegisteredTools] = useState<string[]>([]);
  const [lastToolEffect, setLastToolEffect] = useState<{
    tool: string;
    summary: string;
  } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');

  const onToolEffect = useCallback(
    (effect: { tool: string; summary: string }) => {
      setLastToolEffect(effect);
      setNotice(effect.summary);
      setPulse((value) => value + 1);
    },
    [],
  );

  useWebMCPTools({
    slug,
    state,
    refresh,
    onDetected: setWebmcpDetected,
    onRegistered: setRegisteredTools,
    onEffect: onToolEffect,
    onError: (message) => setActionError(`Agent interface: ${message}`),
  });

  const viableCandidate = state.candidates.find(
    (candidate) => candidate.aggregate.viable,
  );
  const selected =
    viableCandidate ??
    state.candidates.find((candidate) => candidate.id === selectedId) ??
    state.candidates[0];

  async function runAction(label: string, action: () => Promise<ToolResult>) {
    setBusy(label);
    setActionError('');
    try {
      const result = await action();
      const next = await refresh();
      setNotice(result.public_effect ?? result.summary);
      return next;
    } catch (error) {
      if (error instanceof RoomClientError && error.code === 'STALE_ROOM_VERSION') {
        await refresh();
        setActionError('The room changed. We refreshed it before applying your action.');
      } else {
        setActionError(
          error instanceof Error ? error.message : 'That action could not be completed.',
        );
      }
      return null;
    } finally {
      setBusy('');
    }
  }

  async function startFresh() {
    setBusy('fresh');
    try {
      const room = await createDemoRoom();
      window.location.assign(`/room/${encodeURIComponent(room.room_slug)}`);
    } catch (error) {
      setBusy('');
      setActionError(error instanceof Error ? error.message : 'Could not create a room.');
    }
  }

  return (
    <main className={`room-shell phase-${state.room.phase.toLowerCase()} pulse-${pulse % 2}`}>
      <RoomHeader
        state={state}
        connection={connection}
        webmcpDetected={webmcpDetected}
        onPrivacy={() => setPrivacyOpen(true)}
        onTools={() => setToolsOpen(true)}
        onFresh={startFresh}
        freshBusy={busy === 'fresh'}
      />

      {webmcpDetected === false && (
        <output className="compatibility-banner">
          <Code2 aria-hidden="true" />
          <span>
            WebMCP is not available in this browser. The complete human interface still
            works. Open this site in ChatGPT’s built-in browser, or enable WebMCP testing
            in Chrome, to use agent controls.
          </span>
        </output>
      )}

      <div className="room-grid">
        <ParticipantRail state={state} />
        <section className="decision-stage" aria-label="Consensus field">
          {state.room.phase === 'RATIFYING' ? (
            <RatificationPanel
              state={state}
              busy={busy}
              connection={connection}
              runAction={runAction}
            />
          ) : state.room.phase === 'AGREED' ? (
            <AgreementReceipt state={state} onFresh={startFresh} busy={busy} />
          ) : (
            <ConsensusField
              state={state}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              lastToolEffect={lastToolEffect}
            />
          )}
        </section>
        <RightRail
          state={state}
          selected={selected}
          mode={panelMode}
          setMode={setPanelMode}
          busy={busy}
          runAction={runAction}
          onFresh={startFresh}
        />
      </div>

      <div className="room-announcer" aria-live="polite" aria-atomic="true">
        {actionError || notice}
      </div>
      <AnimatePresence>
        {lastToolEffect && (
          <motion.div
            key={`${lastToolEffect.tool}-${pulse}`}
            className="agent-action-toast"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Sparkles aria-hidden="true" />
            <span>
              <strong>Agent action · {lastToolEffect.tool}</strong>
              {lastToolEffect.summary}
            </span>
            <button onClick={() => setLastToolEffect(null)} aria-label="Dismiss agent action">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BriefingDialog
        state={state}
        busy={busy}
        runAction={runAction}
      />
      <PrivacyDialog open={privacyOpen} onOpenChange={setPrivacyOpen} state={state} />
      <ToolsDialog
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        state={state}
        detected={webmcpDetected}
        tools={registeredTools}
        lastEffect={lastToolEffect}
      />
    </main>
  );
}

function RoomHeader({
  state,
  connection,
  webmcpDetected,
  onPrivacy,
  onTools,
  onFresh,
  freshBusy,
}: {
  state: RoomState;
  connection: ConnectionState;
  webmcpDetected: boolean | null;
  onPrivacy: () => void;
  onTools: () => void;
  onFresh: () => void;
  freshBusy: boolean;
}) {
  return (
    <header className="room-header">
      <div className="room-brand">
        <Link href="/" className="wordmark" aria-label="UNSAID home">
          UNSAID
        </Link>
        <span className="header-divider" />
        <div>
          <span>DECISION ROOM</span>
          <strong>{state.room.title}</strong>
        </div>
      </div>
      <div className="phase-pill" aria-live="polite">
        <span aria-hidden="true" /> {PHASE_LABELS[state.room.phase]}
      </div>
      <nav className="room-actions" aria-label="Room utilities">
        {connection !== 'connected' && (
          <div className={`connection-chip ${connection}`}>
            <WifiOff aria-hidden="true" />
            {connection === 'offline' ? 'Offline' : 'Reconnecting…'}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={onPrivacy}>
          <ShieldCheck aria-hidden="true" /> Privacy
        </Button>
        <Button variant="ghost" size="sm" onClick={onTools}>
          <span
            className={`status-dot ${webmcpDetected ? 'ready' : ''}`}
            aria-hidden="true"
          />
          <span aria-live="polite">
            {webmcpDetected === null
              ? 'Checking agent interface…'
              : webmcpDetected
                ? 'Agent interface ready'
                : 'WebMCP not detected'}
          </span>
        </Button>
        <Button variant="outline" size="sm" onClick={onFresh} disabled={freshBusy}>
          <RotateCcw aria-hidden="true" /> Fresh demo
        </Button>
      </nav>
    </header>
  );
}

function ParticipantRail({ state }: { state: RoomState }) {
  return (
    <aside className="participant-rail" aria-labelledby="participants-heading">
      <div className="rail-heading">
        <span>ROOM / 04</span>
        <h2 id="participants-heading">Represented here</h2>
      </div>
      <div className="participant-list">
        {state.participants.map((participant, index) => (
          <motion.article
            className={`participant-card ${participant.is_current ? 'current' : ''}`}
            key={participant.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="participant-avatar">{initials(participant.display_name)}</div>
            <div className="participant-copy">
              <div>
                <strong>{participant.display_name}</strong>
                <span>{participant.badge}</span>
              </div>
              <p>
                <CheckCircle2 aria-hidden="true" /> {participant.status}
              </p>
            </div>
            <ShieldCheck className="participant-shield" aria-label="Private context protected" />
          </motion.article>
        ))}
      </div>

      <div className="privacy-facts">
        <div className="section-kicker">
          <EyeOff aria-hidden="true" /> Minimum disclosure
        </div>
        <dl>
          <div>
            <dt>Raw context from you</dt>
            <dd>Not collected</dd>
          </div>
          <div>
            <dt>Individual ballots</dt>
            <dd>Hidden</dd>
          </div>
          <div>
            <dt>Shared</dt>
            <dd>Structured only</dd>
          </div>
        </dl>
      </div>
      <p className="rail-footnote">
        Demo-agent profiles are deterministic fictional fixtures and remain server-side.
      </p>
    </aside>
  );
}

function fieldPosition(candidate: PublicCandidate, index: number) {
  if (candidate.aggregate.viable) return { x: 50, y: 51 };
  if (candidate.source_kind === 'bridge') return { x: 51, y: 69 };
  return (
    ORIGINAL_POSITIONS[candidate.id] ?? {
      x: 18 + ((index * 29) % 65),
      y: 20 + ((index * 37) % 61),
    }
  );
}

function ringCopy(phase: RoomPhase) {
  if (phase === 'BRIDGING') {
    return { title: 'A BRIDGE IS NEEDED', note: 'Create what does not exist yet' };
  }
  if (phase === 'READY_TO_NOMINATE') {
    return { title: 'COMMON GROUND FOUND', note: 'Ready for nomination' };
  }
  return { title: 'COMMON GROUND', note: 'Waiting for your structured ballot' };
}

function ConsensusField({
  state,
  selectedId,
  onSelect,
  lastToolEffect,
}: {
  state: RoomState;
  selectedId?: string;
  onSelect: (id: string) => void;
  lastToolEffect: { tool: string; summary: string } | null;
}) {
  const copy = ringCopy(state.room.phase);
  const bridge = state.candidates.find(
    (candidate) => candidate.source_kind === 'bridge',
  );
  const base = bridge
    ? state.candidates.find((candidate) => candidate.id === bridge.base_candidate_id)
    : null;
  const bridgePosition = bridge
    ? fieldPosition(bridge, state.candidates.indexOf(bridge))
    : null;
  const basePosition = base
    ? fieldPosition(base, state.candidates.indexOf(base))
    : null;

  return (
    <div className="consensus-field">
      <div className="field-grid" aria-hidden="true" />
      <div className="decision-question">
        <span>THE SHARED QUESTION</span>
        <h1>{state.room.decision_question}</h1>
      </div>

      {bridgePosition && basePosition && (
        <svg className="lineage-layer" aria-hidden="true" viewBox="0 0 100 100">
          <line
            x1={basePosition.x}
            y1={basePosition.y}
            x2={bridgePosition.x}
            y2={bridgePosition.y}
          />
        </svg>
      )}

      <motion.div
        className={`live-common-ring ring-${state.room.phase.toLowerCase()}`}
        animate={{
          scale: state.room.phase === 'READY_TO_NOMINATE' ? [1, 1.035, 1] : 1,
        }}
        transition={{ duration: 0.7 }}
      >
        <span>CONSENSUS FIELD</span>
        <strong>{copy.title}</strong>
        <small>{copy.note}</small>
      </motion.div>

      <AnimatePresence>
        {state.signals.length > 0 && (
          <motion.div
            className="signal-orbit"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {state.signals.slice(0, 7).map((signal, index) => (
              <motion.span
                key={`${signal.field}-${signal.operator}-${String(signal.value)}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                {signal.display}
                {signal.count > 1 ? ` ×${signal.count}` : ''}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="candidate-layer">
        {state.candidates.map((candidate, index) => {
          const position = fieldPosition(candidate, index);
          const support =
            candidate.aggregate.preferred + candidate.aggregate.acceptable;
          const isSelected = selectedId === candidate.id;
          const isViable = candidate.aggregate.viable;
          return (
            <motion.button
              type="button"
              layout
              key={candidate.id}
              aria-pressed={isSelected}
              aria-label={`${candidate.title}, ${support} of 4 can accept`}
              className={`candidate-node ${candidate.source_kind} ${isSelected ? 'selected' : ''} ${isViable ? 'viable' : ''} ${lastToolEffect ? 'recent-tool-effect' : ''}`}
              onClick={() => onSelect(candidate.id)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                opacity:
                  state.room.phase === 'READY_TO_NOMINATE' && !isViable ? 0.42 : 1,
                scale: isViable ? 1.08 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
            >
              <span className="candidate-topline">
                <span>{candidate.source_kind === 'bridge' ? 'AGENT BRIDGE' : 'OPTION'}</span>
                {candidate.source_kind === 'bridge' && <GitBranch aria-hidden="true" />}
              </span>
              <strong>{candidate.title}</strong>
              <span className="candidate-meta">
                {candidate.day.slice(0, 3)} · {formatTime(candidate.start_time)}–
                {formatTime(candidate.end_time)}
              </span>
              <span className="candidate-meta">
                ${candidate.cost_per_person} · {candidate.travel_minutes} min ·{' '}
                {candidate.setting}
              </span>
              <span className="support-row">
                <span className="support-track">
                  <i style={{ width: `${(support / 4) * 100}%` }} />
                </span>
                <b>{isViable ? 'Common ground' : `${support}/4 can accept`}</b>
              </span>
            </motion.button>
          );
        })}
      </div>

      {state.room.phase === 'BRIDGING' && !bridge && (
        <div className="field-callout">
          <GitBranch aria-hidden="true" />
          <span>
            <strong>No existing option works for everyone.</strong>
            The room knows what must change—not why.
          </span>
        </div>
      )}
      {lastToolEffect && (
        <div className="field-agent-marker">
          <Sparkles aria-hidden="true" /> Agent action confirmed
        </div>
      )}
    </div>
  );
}

function RightRail({
  state,
  selected,
  mode,
  setMode,
  busy,
  runAction,
  onFresh,
}: {
  state: RoomState;
  selected?: PublicCandidate;
  mode: 'guide' | 'manual';
  setMode: (mode: 'guide' | 'manual') => void;
  busy: string;
  runAction: RunAction;
  onFresh: () => void;
}) {
  return (
    <aside className="right-rail" aria-label="Decision guide and activity">
      <div className="rail-tabs" role="tablist" aria-label="Guide or manual controls">
        <button
          role="tab"
          aria-selected={mode === 'guide'}
          className={mode === 'guide' ? 'active' : ''}
          onClick={() => setMode('guide')}
        >
          Agent guide
        </button>
        <button
          role="tab"
          aria-selected={mode === 'manual'}
          className={mode === 'manual' ? 'active' : ''}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>

      <div className="right-rail-scroll">
        {mode === 'guide' ? (
          <GuidePanel
            state={state}
            selected={selected}
            busy={busy}
            runAction={runAction}
            onFresh={onFresh}
          />
        ) : (
          <ManualControls
            key={state.room.phase}
            state={state}
            busy={busy}
            runAction={runAction}
          />
        )}
        {selected && state.room.phase !== 'AGREED' && (
          <CandidateDetails candidate={selected} />
        )}
        <ActivityLedger state={state} />
      </div>
    </aside>
  );
}

function GuidePanel({
  state,
  selected,
  busy,
  runAction,
  onFresh,
}: {
  state: RoomState;
  selected?: PublicCandidate;
  busy: string;
  runAction: RunAction;
  onFresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(PRIVATE_AGENT_BRIEF);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (state.room.phase === 'AGREED') {
    return (
      <section className="guide-card final-guide">
        <span className="section-kicker"><Check aria-hidden="true" /> Complete</span>
        <h2>The agreement is human-ratified.</h2>
        <p>Start a fresh disposable room to replay the complete agent and human flow.</p>
        <Button onClick={onFresh} disabled={busy === 'fresh'}>
          <RotateCcw aria-hidden="true" /> Fresh demo
        </Button>
      </section>
    );
  }

  if (state.room.phase === 'READY_TO_NOMINATE') {
    const viable =
      state.candidates.find((candidate) => candidate.aggregate.viable) ?? selected;
    return (
      <section className="guide-card ready-guide">
        <span className="section-kicker"><Sparkles aria-hidden="true" /> Common ground found</span>
        <h2>{viable?.title}</h2>
        <p>
          Every represented participant can accept this bridge. Nomination opens the
          shared human-ratification step; it does not approve the result for you.
        </p>
        {viable && (
          <Button
            className="wide-action"
            disabled={Boolean(busy)}
            onClick={() =>
              void runAction('nominate', () =>
                roomClient.nominate(
                  state.room.slug,
                  {
                    room_version: state.room.version,
                    candidate_id: viable.id,
                  },
                  { origin: 'human_ui' },
                ),
              )
            }
          >
            Nominate for ratification <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </section>
    );
  }

  if (state.room.phase === 'BRIDGING') {
    return (
      <>
        <section className="guide-card bridge-guide">
          <span className="section-kicker"><GitBranch aria-hidden="true" /> Bridge phase</span>
          <h2>Create an option that does not exist yet.</h2>
          <p>
            Ask your agent to use the room’s shared signals plus your private context
            to modify a strong starting option with the fewest meaningful changes.
          </p>
          <div className="agent-prompt-mini">
            “Use the public signals to create the strongest common-ground proposal.”
          </div>
        </section>
        <SignalList state={state} />
      </>
    );
  }

  return (
    <section className="guide-card private-brief-card">
      <span className="section-kicker"><LockKeyhole aria-hidden="true" /> Private brief for your agent</span>
      <h2>Your full context belongs in your conversation.</h2>
      <p className="brief-copy">{PRIVATE_AGENT_BRIEF}</p>
      <Button variant="outline" className="wide-action" onClick={copyBrief}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Copied to clipboard' : 'Copy private agent brief'}
      </Button>
      <p className="microcopy">
        This text is a demo prompt. The room has no raw-context field and does not
        receive what you tell ChatGPT.
      </p>
    </section>
  );
}

function SignalList({ state }: { state: RoomState }) {
  return (
    <section className="signal-list-card">
      <span className="section-kicker"><Network aria-hidden="true" /> Common-ground signals</span>
      <div className="signal-list">
        {state.signals.map((signal) => (
          <div key={`${signal.field}-${signal.operator}-${String(signal.value)}`}>
            <span>{signal.display}</span>
            {signal.count > 1 && <b>×{signal.count}</b>}
          </div>
        ))}
      </div>
      <p className="warning-copy">
        Source hidden is not the same as anonymous. In a small group, people may
        still infer who needs a change.
      </p>
    </section>
  );
}

function ManualControls({
  state,
  busy,
  runAction,
}: {
  state: RoomState;
  busy: string;
  runAction: RunAction;
}) {
  const [ballot, setBallot] = useState<Record<string, Stance>>(
    state.current_participant.ballot,
  );
  const [baseCandidateId, setBaseCandidateId] = useState('lakeside-lab');
  const [bridgeDay, setBridgeDay] = useState('Thursday');
  const [bridgeEnd, setBridgeEnd] = useState('16:00');
  const [bridgeCost, setBridgeCost] = useState('235');
  const [signalField, setSignalField] = useState<
    'day' | 'end_time' | 'cost_per_person' | 'setting'
  >('day');
  const [signalValue, setSignalValue] = useState('Thursday');

  const targets = state.candidates.filter((candidate) =>
    state.room.phase === 'COLLECTING'
      ? candidate.source_kind === 'original'
      : candidate.source_kind === 'bridge',
  );

  function setStance(candidateId: string, stance: Stance) {
    setBallot((draft) => ({ ...draft, [candidateId]: stance }));
  }

  function applyExampleBallot() {
    setBallot((draft) => ({
      ...draft,
      'river-run': 'unacceptable',
      'city-studio': 'unacceptable',
      'mountain-lodge': 'unacceptable',
      'lakeside-lab': 'unacceptable',
      'museum-sprint': 'acceptable',
    }));
  }

  async function submitManualBallot() {
    const evaluations = targets
      .filter((candidate) => ballot[candidate.id])
      .map((candidate) => ({
        candidate_id: candidate.id,
        stance: ballot[candidate.id],
      }));
    await runAction('ballot', () =>
      roomClient.submitBallot(
        state.room.slug,
        { room_version: state.room.version, evaluations },
        { origin: 'human_ui' },
      ),
    );
  }

  async function createBridge() {
    await runAction('bridge', () =>
      roomClient.proposeBridge(
        state.room.slug,
        {
          room_version: state.room.version,
          base_candidate_id: baseCandidateId,
          changes: [
            { field: 'day', value: bridgeDay },
            { field: 'end_time', value: bridgeEnd },
            { field: 'cost_per_person', value: Number(bridgeCost) },
          ],
        },
        { origin: 'human_ui' },
      ),
    );
  }

  const signalConfiguration: Record<
    typeof signalField,
    { operator: 'equals' | 'at_or_before' | 'at_most' | 'prefers'; numeric?: boolean }
  > = {
    day: { operator: 'equals' },
    end_time: { operator: 'at_or_before' },
    cost_per_person: { operator: 'at_most', numeric: true },
    setting: { operator: 'prefers' },
  };

  function chooseSignalField(value: typeof signalField) {
    setSignalField(value);
    const defaults: Record<typeof signalField, string> = {
      day: 'Thursday',
      end_time: '16:30',
      cost_per_person: '250',
      setting: 'Mixed',
    };
    setSignalValue(defaults[value]);
  }

  async function publishManualSignal() {
    const configuration = signalConfiguration[signalField];
    await runAction('signal', () =>
      roomClient.publishSignal(
        state.room.slug,
        {
          room_version: state.room.version,
          field: signalField,
          operator: configuration.operator,
          value: configuration.numeric ? Number(signalValue) : signalValue,
          visibility: 'source_hidden',
        },
        { origin: 'human_ui' },
      ),
    );
  }

  if (state.room.phase === 'COLLECTING') {
    const complete = targets.every((candidate) => ballot[candidate.id]);
    return (
      <section className="manual-card">
        <div className="manual-heading">
          <div>
            <span>MANUAL FALLBACK</span>
            <h2>Structured ballot</h2>
          </div>
          <button type="button" onClick={applyExampleBallot}>
            Use demo brief
          </button>
        </div>
        <div className="ballot-list">
          {targets.map((candidate) => (
            <fieldset key={candidate.id}>
              <legend>{candidate.title}</legend>
              <div className="stance-segment">
                {STANCE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={ballot[candidate.id] === option.value ? 'selected' : ''}
                    aria-pressed={ballot[candidate.id] === option.value}
                    onClick={() => setStance(candidate.id, option.value)}
                  >
                    {option.short}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <Button
          className="wide-action"
          disabled={!complete || Boolean(busy)}
          onClick={() => void submitManualBallot()}
        >
          Submit structured ballot <ChevronRight aria-hidden="true" />
        </Button>
        <p className="microcopy">Only candidate IDs and stance values are sent.</p>
      </section>
    );
  }

  if (state.room.phase === 'BRIDGING' && targets.length === 0) {
    return (
      <section className="manual-card">
        <span className="section-kicker"><GitBranch aria-hidden="true" /> Manual bridge builder</span>
        <label>
          Starting option
          <select value={baseCandidateId} onChange={(event) => setBaseCandidateId(event.target.value)}>
            {state.candidates
              .filter((candidate) => candidate.source_kind === 'original')
              .map((candidate) => (
                <option value={candidate.id} key={candidate.id}>
                  {candidate.title}
                </option>
              ))}
          </select>
        </label>
        <div className="bridge-form-grid">
          <label>
            Day
            <select value={bridgeDay} onChange={(event) => setBridgeDay(event.target.value)}>
              <option>Thursday</option>
              <option>Friday</option>
              <option>Wednesday</option>
            </select>
          </label>
          <label>
            End
            <input type="time" value={bridgeEnd} onChange={(event) => setBridgeEnd(event.target.value)} />
          </label>
          <label>
            Cost / person
            <input type="number" min="0" max="2000" value={bridgeCost} onChange={(event) => setBridgeCost(event.target.value)} />
          </label>
        </div>
        <Button className="wide-action" disabled={Boolean(busy)} onClick={() => void createBridge()}>
          <Plus aria-hidden="true" /> Create bridge proposal
        </Button>

        <div className="manual-divider" />
        <span className="section-kicker"><EyeOff aria-hidden="true" /> Optional shared signal</span>
        <div className="signal-form">
          <select
            aria-label="Signal field"
            value={signalField}
            onChange={(event) => chooseSignalField(event.target.value as typeof signalField)}
          >
            <option value="day">Day must be</option>
            <option value="end_time">Finish by</option>
            <option value="cost_per_person">Cost at most</option>
            <option value="setting">Setting preferred</option>
          </select>
          <input
            aria-label="Signal value"
            value={signalValue}
            onChange={(event) => setSignalValue(event.target.value)}
          />
        </div>
        <Button variant="outline" className="wide-action" disabled={Boolean(busy)} onClick={() => void publishManualSignal()}>
          Publish source-hidden signal
        </Button>
      </section>
    );
  }

  if (state.room.phase === 'BRIDGING' && targets.length > 0) {
    const complete = targets.every((candidate) => ballot[candidate.id]);
    return (
      <section className="manual-card">
        <span className="section-kicker"><CheckCircle2 aria-hidden="true" /> Evaluate the bridge</span>
        {targets.map((candidate) => (
          <fieldset key={candidate.id}>
            <legend>{candidate.title}</legend>
            <div className="stance-segment">
              {STANCE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={ballot[candidate.id] === option.value ? 'selected' : ''}
                  aria-pressed={ballot[candidate.id] === option.value}
                  onClick={() => setStance(candidate.id, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <Button className="wide-action" disabled={!complete || Boolean(busy)} onClick={() => void submitManualBallot()}>
          Submit bridge evaluation <ChevronRight aria-hidden="true" />
        </Button>
      </section>
    );
  }

  if (state.room.phase === 'READY_TO_NOMINATE') {
    const viable = state.candidates.find((candidate) => candidate.aggregate.viable);
    return (
      <section className="manual-card">
        <span className="section-kicker"><Sparkles aria-hidden="true" /> Manual nomination</span>
        <h2>{viable?.title ?? 'Common-ground proposal'}</h2>
        <p>
          This proposal is acceptable to everyone represented. Nomination moves it to
          the visible human-ratification checkpoint; it does not approve the agreement.
        </p>
        {viable && (
          <Button
            className="wide-action"
            disabled={Boolean(busy)}
            onClick={() =>
              void runAction('nominate', () =>
                roomClient.nominate(
                  state.room.slug,
                  {
                    room_version: state.room.version,
                    candidate_id: viable.id,
                  },
                  { origin: 'human_ui' },
                ),
              )
            }
          >
            Nominate for ratification <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="manual-card">
      <span className="section-kicker"><CheckCircle2 aria-hidden="true" /> Manual controls</span>
      <p>The next human action is shown in the main decision stage.</p>
    </section>
  );
}

function CandidateDetails({ candidate }: { candidate: PublicCandidate }) {
  const support = candidate.aggregate.preferred + candidate.aggregate.acceptable;
  return (
    <section className="candidate-detail-card">
      <div className="detail-heading">
        <span>{candidate.source_kind === 'bridge' ? 'BRIDGE DETAILS' : 'OPTION DETAILS'}</span>
        <b>{support}/4 can accept</b>
      </div>
      <h2>{candidate.title}</h2>
      <div className="attribute-grid">
        <span><Clock3 aria-hidden="true" /> {candidate.day}, {formatTime(candidate.start_time)}–{formatTime(candidate.end_time)}</span>
        <span><DollarSign aria-hidden="true" /> ${candidate.cost_per_person} per person</span>
        <span><MapPin aria-hidden="true" /> {candidate.travel_minutes} minutes · {candidate.setting}</span>
        <span><ShieldCheck aria-hidden="true" /> {candidate.accessibility}</span>
        <span><Users aria-hidden="true" /> {candidate.format}</span>
      </div>
      {candidate.changes.length > 0 && (
        <div className="change-list">
          {candidate.changes.map((change) => (
            <span key={change.field}>
              <b>{change.field.replaceAll('_', ' ')}</b>
              {String(change.from)} <ArrowRight aria-hidden="true" /> {String(change.to)}
            </span>
          ))}
        </div>
      )}
      <div className="aggregate-grid" aria-label="Aggregate support">
        <span><b>{candidate.aggregate.preferred}</b> prefer</span>
        <span><b>{candidate.aggregate.acceptable}</b> accept</span>
        <span><b>{candidate.aggregate.unacceptable}</b> cannot</span>
        <span><b>{candidate.aggregate.missing}</b> missing</span>
      </div>
    </section>
  );
}

function ActivityLedger({ state }: { state: RoomState }) {
  return (
    <section className="ledger-card" aria-labelledby="ledger-heading">
      <div className="detail-heading">
        <span id="ledger-heading">PUBLIC ACTION LEDGER</span>
        <Activity aria-hidden="true" />
      </div>
      <ol>
        {state.audit_events.map((event) => (
          <li key={event.id} className={`origin-${event.origin}`}>
            <span aria-hidden="true" />
            <div>
              <p>{event.public_summary}</p>
              <small>
                {event.origin === 'webmcp'
                  ? 'Agent action'
                  : event.origin === 'demo_fixture'
                    ? 'Deterministic fixture'
                    : event.origin === 'human_ui'
                      ? 'Human action'
                      : 'Room system'}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RatificationPanel({
  state,
  busy,
  connection,
  runAction,
}: {
  state: RoomState;
  busy: string;
  connection: ConnectionState;
  runAction: RunAction;
}) {
  const candidate = state.candidates.find(
    (entry) => entry.id === state.room.nominated_candidate_id,
  );
  if (!candidate) return null;
  return (
    <motion.section
      className="ratification-panel"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="ratify-orbit" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <i key={index} />)}
      </div>
      <span className="section-kicker"><LockKeyhole aria-hidden="true" /> Human checkpoint</span>
      <h1>Agents found the bridge.<br /><em>People make the agreement.</em></h1>
      <div className="ratify-candidate">
        <div>
          <span>NOMINATED COMMON GROUND</span>
          <h2>{candidate.title}</h2>
          <p>
            {candidate.day} · {formatTime(candidate.start_time)}–{formatTime(candidate.end_time)} · ${candidate.cost_per_person} per person
          </p>
        </div>
        <div className="ratify-score">
          <strong>4/4</strong>
          <span>can accept</span>
        </div>
      </div>
      <div className="fit-strip">
        {state.signals.slice(0, 6).map((signal) => (
          <span key={`${signal.field}-${signal.operator}`}><Check aria-hidden="true" /> {signal.display}</span>
        ))}
      </div>
      <div className="ratify-status">
        {state.participants.map((participant) => (
          <div key={participant.id}>
            <span>{initials(participant.display_name)}</span>
            <strong>{participant.display_name}</strong>
            <small>{participant.is_current ? 'Your click is required' : 'Ratified · Demo agent'}</small>
          </div>
        ))}
      </div>
      <div className="ratify-actions">
        <Button
          className="ratify-primary"
          size="lg"
          disabled={Boolean(busy) || connection !== 'connected'}
          onClick={() =>
            void runAction('ratify', () =>
              roomClient.ratify(state.room.slug, {
                room_version: state.room.version,
                candidate_id: candidate.id,
                decision: 'approve',
              }),
            )
          }
        >
          <CheckCircle2 aria-hidden="true" /> I ratify this agreement
        </Button>
        <Button
          variant="ghost"
          disabled={Boolean(busy) || connection !== 'connected'}
          onClick={() =>
            void runAction('decline', () =>
              roomClient.ratify(state.room.slug, {
                room_version: state.room.version,
                candidate_id: candidate.id,
                decision: 'decline',
              }),
            )
          }
        >
          Return to bridging
        </Button>
      </div>
      <p className="ratify-note">
        {connection === 'connected'
          ? 'This approval is available only in the visible human interface. No site tool can click it for you.'
          : 'Ratification is paused while the room reconnects, so your final decision cannot be duplicated or lost.'}
      </p>
    </motion.section>
  );
}

function AgreementReceipt({
  state,
  onFresh,
  busy,
}: {
  state: RoomState;
  onFresh: () => void;
  busy: string;
}) {
  const candidate = state.candidates.find(
    (entry) => entry.id === state.room.nominated_candidate_id,
  );
  if (!candidate) return null;

  function exportReceipt() {
    const content = JSON.stringify(
      {
        product: 'UNSAID',
        room: state.room.slug,
        agreement: candidate,
        privacy: state.privacy,
        public_audit: state.audit_events,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `unsaid-agreement-${state.room.slug}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.section
      className="agreement-receipt"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="agreement-ring" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" />
        </svg>
        <Check aria-hidden="true" />
      </div>
      <span className="section-kicker"><CheckCircle2 aria-hidden="true" /> Agreement / final</span>
      <h1>Agreement reached<br /><em>without saying everything.</em></h1>
      <article className="final-candidate">
        <div>
          <span>THE AGREEMENT</span>
          <h2>{candidate.title}</h2>
        </div>
        <p>
          {candidate.day}, {formatTime(candidate.start_time)}–{formatTime(candidate.end_time)} · {candidate.accessibility} · {candidate.setting} · {candidate.format} · ${candidate.cost_per_person} per person
        </p>
      </article>
      <div className="receipt-metrics">
        <div><strong>4</strong><span>people represented</span></div>
        <div><strong>5</strong><span>original options</span></div>
        <div><strong>{state.privacy.bridge_proposals}</strong><span>bridge created</span></div>
        <div className="privacy-metric"><strong>0</strong><span>raw private reasons received</span></div>
      </div>
      <div className="receipt-accounting">
        <span>{state.privacy.structured_ballot_entries} structured ballot entries</span>
        <span>{state.privacy.structured_signals_shared} structured signals shared</span>
        <span>{state.privacy.agent_actions} agent/demo-originated actions</span>
        <span>{state.privacy.human_actions} human-originated actions</span>
      </div>
      <div className="receipt-actions">
        <Button variant="outline" onClick={exportReceipt}><Download aria-hidden="true" /> Export receipt</Button>
        <Button onClick={onFresh} disabled={busy === 'fresh'}><RefreshCw aria-hidden="true" /> Fresh demo</Button>
      </div>
      <blockquote>
        The old web helps one person transact. <strong>UNSAID helps many people agree.</strong>
      </blockquote>
      <p className="receipt-warning">
        Minimum disclosure is not anonymity. Source-hidden signals may still be inferable in a small group.
      </p>
    </motion.section>
  );
}

function BriefingDialog({
  state,
  busy,
  runAction,
}: {
  state: RoomState;
  busy: string;
  runAction: RunAction;
}) {
  const [copied, setCopied] = useState(false);
  async function copyBrief() {
    await navigator.clipboard.writeText(PRIVATE_AGENT_BRIEF);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={state.room.phase === 'BRIEFING'} onOpenChange={() => undefined}>
      <DialogContent className="briefing-dialog" showCloseButton={false}>
        <DialogHeader>
          <span className="section-kicker"><ShieldCheck aria-hidden="true" /> Decision briefing</span>
          <DialogTitle>
            Four people. Five options.<br />No one should have to explain everything.
          </DialogTitle>
          <DialogDescription>
            {state.room.decision_question}
          </DialogDescription>
        </DialogHeader>
        <div className="briefing-participants">
          {state.participants.map((participant) => (
            <div key={participant.id}>
              <span>{initials(participant.display_name)}</span>
              <strong>{participant.display_name}</strong>
              <small>{participant.badge}</small>
            </div>
          ))}
        </div>
        <div className="briefing-privacy">
          <EyeOff aria-hidden="true" />
          <p>
            Tell ChatGPT your full private context. This room accepts only structured
            judgments, signals, proposals, and ratifications—not your explanation.
          </p>
        </div>
        <div className="briefing-brief">
          <span>YOUR AGENT BRIEF</span>
          <p>{PRIVATE_AGENT_BRIEF}</p>
          <Button variant="outline" onClick={copyBrief}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy brief'}
          </Button>
        </div>
        <Button
          size="lg"
          className="enter-room-button"
          disabled={Boolean(busy)}
          onClick={() =>
            void runAction('begin', () =>
              roomClient.begin(state.room.slug, state.room.version),
            )
          }
        >
          Enter the decision room <ArrowRight aria-hidden="true" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PrivacyDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoomState;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="info-dialog">
        <DialogHeader>
          <span className="section-kicker"><ShieldCheck aria-hidden="true" /> Honest privacy boundary</span>
          <DialogTitle>Minimum disclosure, precisely described.</DialogTitle>
          <DialogDescription>
            UNSAID is a coordination prototype, not an anonymity or encryption system.
          </DialogDescription>
        </DialogHeader>
        <dl className="privacy-dialog-list">
          <div><dt>Raw private context from you</dt><dd>Not requested or stored</dd></div>
          <div><dt>Other individual ballots</dt><dd>Hidden from the shared view</dd></div>
          <div><dt>Structured ballot entries</dt><dd>{state.privacy.structured_ballot_entries}</dd></div>
          <div><dt>Structured signals stored</dt><dd>{state.privacy.structured_signals_shared}</dd></div>
        </dl>
        <p className="privacy-disclosure">
          The room stores structured ballots, source-hidden structured signals,
          proposals, and ratification events for the life of this demo room. In a
          small group, participants may infer who needs a particular change.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ToolsDialog({
  open,
  onOpenChange,
  state,
  detected,
  tools,
  lastEffect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RoomState;
  detected: boolean | null;
  tools: string[];
  lastEffect: { tool: string; summary: string } | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="info-dialog tools-dialog">
        <DialogHeader>
          <span className="section-kicker"><Code2 aria-hidden="true" /> WebMCP / live protocol</span>
          <DialogTitle>
            {detected === null
              ? 'Checking agent interface…'
              : detected
                ? 'Agent interface ready'
                : 'WebMCP not detected'}
          </DialogTitle>
          <DialogDescription>
            Phase: {PHASE_LABELS[state.room.phase]}. Tools are registered by this
            top-level page and reuse the same room operations as the human controls.
          </DialogDescription>
        </DialogHeader>
        <div className="tool-list">
          {(tools.length ? tools : ['No site tools registered in this browser']).map(
            (tool) => <code key={tool}>{tool}</code>,
          )}
        </div>
        {lastEffect ? (
          <div className="last-tool-card">
            <span>LAST TOOL EFFECT · {lastEffect.tool}</span>
            <p>{lastEffect.summary}</p>
          </div>
        ) : (
          <p className="privacy-disclosure">
            A successful site-tool call will appear here and in the public action
            ledger. Raw authorization headers and full payloads are never shown.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
