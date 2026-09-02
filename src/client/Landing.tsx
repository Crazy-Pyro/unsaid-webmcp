'use client';

import { useState } from 'react';
import { ArrowRight, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createDemoRoom } from '@/src/client/room-client';

const previewCandidates = [
  { name: 'River Run', note: '3/4 can accept', className: 'node-one' },
  { name: 'City Studio', note: '2/4 can accept', className: 'node-two' },
  { name: 'Lakeside Lab', note: '3/4 can accept', className: 'node-three' },
  { name: 'Museum Sprint', note: '3/4 can accept', className: 'node-four' },
];

export function Landing() {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function startDemo() {
    setStarting(true);
    setError('');
    try {
      const room = await createDemoRoom();
      window.location.assign(`/room/${encodeURIComponent(room.room_slug)}`);
    } catch (cause) {
      setStarting(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'A fresh demo room could not be created.',
      );
    }
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div className="wordmark">UNSAID</div>
        <div className="header-tagline">Private context. Shared agreement.</div>
        <div className="prototype-pill">
          <span aria-hidden="true" /> WebMCP challenge prototype
        </div>
      </header>

      <section className="landing-grid" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles aria-hidden="true" /> A new surface for collective decisions
          </div>
          <h1 id="hero-heading">
            Tell your agent the whole truth.
            <em>Tell the room only enough to agree.</em>
          </h1>
          <p className="hero-summary">
            A minimum-disclosure decision room where personal agents turn private
            context into structured common ground, and people make the final call.
          </p>
          <div className="hero-actions">
            <Button
              className="primary-cta"
              size="lg"
              onClick={startDemo}
              disabled={starting}
            >
              {starting ? 'Opening a fresh room…' : 'Start judge demo'}
              {!starting && <ArrowRight aria-hidden="true" />}
            </Button>
            <a href="#principles">See how UNSAID works</a>
          </div>
          {error && (
            <p className="landing-error" role="alert">
              {error}
            </p>
          )}
          <div id="principles" className="principle-row">
            <article>
              <span>01</span>
              <strong>Brief privately</strong>
              <p>Your full context stays in your own conversation.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Share structure</strong>
              <p>The room receives judgments, signals, and proposals.</p>
            </article>
            <article>
              <span>03</span>
              <strong>Ratify as a person</strong>
              <p>Agents find the bridge. Humans approve the agreement.</p>
            </article>
          </div>
        </div>

        <div className="field-preview" aria-label="Preview of the UNSAID consensus field">
          <div className="field-grid" />
          <div className="field-label">
            <span>TEAM OFFSITE</span>
            <strong>Where can four people meet?</strong>
          </div>
          <div className="common-ring">
            <div>
              <span>COMMON</span>
              <strong>GROUND</strong>
              <small>A bridge is needed</small>
            </div>
          </div>
          {previewCandidates.map((candidate) => (
            <article className={`preview-node ${candidate.className}`} key={candidate.name}>
              <span className="node-dot" aria-hidden="true" />
              <strong>{candidate.name}</strong>
              <small>{candidate.note}</small>
            </article>
          ))}
          <div className="privacy-chip">
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>0</strong> raw private reasons collected
            </span>
          </div>
          <div className="agent-chip">
            <EyeOff aria-hidden="true" /> Individual ballots stay hidden
          </div>
        </div>
      </section>
    </main>
  );
}
