import { readTags, useTags } from "../../core/media/tags";
import { matches } from "../../core/media/formats";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Square,
  X,
} from "lucide-react";
import { Library, MediaArtwork } from "./Shared";
import { useFilesystem } from "../../core/filesystem/hooks";
import { useMediaUrl, useActiveFile, report } from "../../core/media/hooks";
import { useMediaState, clock, editableTarget } from "../../core/media/state";
import { useDesk } from "../../core/store";
function Visualizer({ audio }: { audio: HTMLAudioElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useDesk((s) => s.prefs.reducedMotion);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  useEffect(() => {
    if (!audio) return;
    let frame = 0;
    let context: AudioContext | undefined;
    let source: MediaElementAudioSourceNode | undefined;
    const start = () => {
      try {
        if (!context) {
          context = new AudioContext();
          source = context.createMediaElementSource(audio);
          const analyser = context.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyser.connect(context.destination);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const draw = () => {
            if (!ref.current) return;
            const c = ref.current.getContext("2d")!;
            analyser.getByteFrequencyData(data);
            c.clearRect(0, 0, 320, 90);
            c.fillStyle = "#bd9fda";
            data.forEach((v, i) => c.fillRect(i * 5, 90 - v / 3, 3, v / 3));
            frame = requestAnimationFrame(draw);
          };
          if (
            !reducedRef.current &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            draw();
        }
        void context.resume();
      } catch {
        /* Audio playback remains available without visualization. */
      }
    };
    audio.addEventListener("play", start);
    if (!audio.paused) start();
    return () => {
      audio.removeEventListener("play", start);
      cancelAnimationFrame(frame);
      source?.disconnect();
      void context?.close();
    };
  }, [audio]);
  return (
    <canvas
      className="audio-visualizer"
      ref={ref}
      width={320}
      height={90}
      aria-label="Live audio frequency visualization"
    />
  );
}
export default function Music() {
  const { entries } = useFilesystem();
  const [id, select] = useActiveFile();
  const entry = entries.find((e) => e.id === id && !e.trashed);
  const media = useMediaUrl(entry);
  const meta = useMediaState();
  const tags = useTags((s) => s.tracks);
  const [art, setArt] = useState<{ id: string; url: string }>({
    id: "",
    url: "",
  });
  useEffect(() => {
    if (!entry) return;
    let alive = true,
      url = "";
    void readTags(entry, true)
      .then((blob) => {
        if (alive && blob) {
          url = URL.createObjectURL(blob);
          setArt({ id: entry.id, url });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry]);
  const ref = useRef<HTMLAudioElement>(null),
    [element, setElement] = useState<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState(""),
    [view, setView] = useState("library"),
    [queueOpen, setQueueOpen] = useState(false);
  const [volume, setVolume] = useState(() =>
      Math.min(1, Math.max(0, Number(meta.preferences.volume ?? 0.7))),
    ),
    [muted, setMuted] = useState(false),
    [shuffle, setShuffle] = useState(false),
    [repeat, setRepeat] = useState("off");
  const bindAudio = useCallback((node: HTMLAudioElement | null) => {
    ref.current = node;
    setElement(node);
  }, []);
  const wantsPlay = useRef(false),
    lastProgress = useRef(0);
  const all = entries.filter((e) => matches(e, "music"));
  const ids =
    queue !== null
      ? queue.filter((id) => all.some((e) => e.id === id))
      : all.map((e) => e.id);
  const choose = (next: string) => {
    wantsPlay.current = true;
    setError("");
    select(next);
    if (next === id) void ref.current?.play().catch((e) => setError(String(e)));
  };
  const advance = (delta: number, ended = false) => {
    if (ended && repeat === "one") {
      if (ref.current) {
        ref.current.currentTime = 0;
        void ref.current.play().catch(report);
      }
      return;
    }
    let i = shuffle
      ? Math.floor(Math.random() * ids.length)
      : ids.indexOf(id) + delta;
    if (i >= ids.length || i < 0) {
      if (repeat === "all") i = (i + ids.length) % ids.length;
      else return;
    }
    if (ids[i]) choose(ids[i]);
  };
  const toggle = () => {
    if (!entry && ids[0]) choose(ids[0]);
    else if (ref.current?.paused) {
      void ref.current
        .play()
        .catch((e) =>
          setError(
            "Playback needs a supported audio file and a user gesture. " + e,
          ),
        );
    } else ref.current?.pause();
  };
  useEffect(() => {
    if (!element) return;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [element]);
  useEffect(() => {
    const a = ref.current;
    if (a) {
      a.volume = volume;
      a.muted = muted;
    }
  }, [volume, muted]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = entry
      ? new MediaMetadata({ title: entry.name })
      : null;
    navigator.mediaSession.setActionHandler("play", () => {
      void ref.current?.play().catch(report);
    });
    navigator.mediaSession.setActionHandler("pause", () =>
      ref.current?.pause(),
    );
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.metadata = null;
    };
  }, [entry]);
  return (
    <div
      className={
        "media-app music-app " + (view === "mini player" ? "mini-mode" : "")
      }
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
          e.preventDefault();
          const root = e.currentTarget;
          setView("library");
          requestAnimationFrame(() =>
            root.querySelector<HTMLInputElement>('input[type="file"]')?.click(),
          );
          return;
        }
        if (editableTarget(e.target)) return;
        if (e.code === "Space") {
          e.preventDefault();
          toggle();
        }
        if (e.key.toLowerCase() === "m") setMuted(!muted);
        if (["ArrowLeft", "ArrowRight"].includes(e.key) && ref.current) {
          e.preventDefault();
          ref.current.currentTime = Math.max(
            0,
            ref.current.currentTime + (e.key === "ArrowRight" ? 5 : -5),
          );
        }
      }}
    >
      <audio
        ref={bindAudio}
        src={media.url || undefined}
        preload="metadata"
        onLoadedMetadata={() => {
          const a = ref.current!;
          setDuration(a.duration);
          setTime(0);
          if (wantsPlay.current) {
            wantsPlay.current = false;
            void a.play().catch((e) => setError(String(e)));
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const a = ref.current!;
          setTime(a.currentTime);
          if (Date.now() - lastProgress.current > 5000) {
            lastProgress.current = Date.now();
            if (id)
              meta.progressFor(id, {
                position: a.currentTime,
                duration: a.duration || 0,
                opened: Date.now(),
              });
          }
        }}
        onEnded={() => advance(1, true)}
        onError={() =>
          setError(
            "This audio could not be played. Try a browser-supported MP3, WAV or OGG file.",
          )
        }
      />
      <div className="media-view-switch">
        {["library", "now playing", "mini player"].map((v) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <button onClick={() => setQueueOpen(!queueOpen)}>
          Queue ? {ids.length}
        </button>
      </div>
      {(error || media.error || (id && !entry)) && (
        <div className="media-error" role="alert">
          {error || media.error || "This track is missing or in Trash."}
        </div>
      )}
      <div className="media-workspace">
        {view === "library" ? (
          <Library
            kind="music"
            active={id}
            onOpen={(e, ids) => {
              setQueue(ids);
              choose(e.id);
            }}
            onQueue={(id) => setQueue((q) => [...(q || []), id])}
          />
        ) : (
          <div className="now-playing">
            {art.id === id && art.url ? (
              <img
                className="album-cover"
                src={art.url}
                alt="Embedded album artwork"
              />
            ) : (
              <MediaArtwork entry={entry} kind="music" />
            )}
            <div>
              <small>NOW PLAYING</small>
              <h2>
                {tags[id]?.title || entry?.name || "Choose your soundtrack"}
              </h2>
              <p>
                Original local audio /{" "}
                {entry?.extension.toUpperCase() || "Your library"}
              </p>
            </div>
          </div>
        )}
        {queueOpen && (
          <aside className="media-queue">
            <h3>Up next</h3>
            <button onClick={() => setQueue(null)}>Reset queue</button>
            {ids.map((q, i) => (
              <div
                key={q + i}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/queue", String(i))
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = Number(e.dataTransfer.getData("text/queue"));
                  const next = [...ids];
                  next.splice(i, 0, next.splice(from, 1)[0]);
                  setQueue(next);
                }}
              >
                <button onClick={() => choose(q)}>
                  {entries.find((e) => e.id === q)?.name}
                </button>
                <button
                  aria-label="Remove queued track"
                  onClick={() => setQueue(ids.filter((_, j) => j !== i))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </aside>
        )}
      </div>
      <div
        style={{
          display: view === "library" ? "none" : "flex",
          justifyContent: "center",
        }}
      >
        <Visualizer audio={element} />
      </div>
      <footer className="media-player-bar">
        <div className="media-track-label">
          <strong>{tags[id]?.title || entry?.name || "Nothing playing"}</strong>
          <small>
            {playing ? "Playing" : "Paused"} /{" "}
            {entry?.extension.toUpperCase() || "Music"}
          </small>
        </div>
        <div className="media-transport">
          <div>
            <button
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={15} />
            </button>
            <button aria-label="Previous track" onClick={() => advance(-1)}>
              <SkipBack size={17} />
            </button>
            <button
              className="round-play"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <button aria-label="Next track" onClick={() => advance(1)}>
              <SkipForward size={17} />
            </button>
            <button
              title={"Repeat " + repeat}
              aria-label={"Repeat " + repeat}
              onClick={() =>
                setRepeat(
                  repeat === "off" ? "all" : repeat === "all" ? "one" : "off",
                )
              }
            >
              <Repeat size={15} />
              {repeat}
            </button>
            <button
              aria-label="Stop"
              onClick={() => {
                ref.current?.pause();
                if (ref.current) ref.current.currentTime = 0;
              }}
            >
              <Square size={13} />
            </button>
          </div>
          <div>
            <small>{clock(time)}</small>
            <input
              aria-label="Seek audio"
              type="range"
              min="0"
              max={duration || 1}
              step=".1"
              value={Math.min(time, duration || 1)}
              onChange={(e) => {
                if (ref.current)
                  ref.current.currentTime = Number(e.target.value);
              }}
            />
            <small>{clock(duration)}</small>
          </div>
        </div>
        <div className="media-volume">
          <button aria-label="Mute audio" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            aria-label="Audio volume"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={volume}
            onChange={(e) => {
              const n = Number(e.target.value);
              setVolume(n);
              meta.preference("volume", n);
            }}
          />
        </div>
      </footer>
    </div>
  );
}
