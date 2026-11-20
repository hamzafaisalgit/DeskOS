import { matches } from "../../core/media/formats";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  ArrowLeft,
  PictureInPicture,
} from "lucide-react";
import { Library } from "./Shared";
import { useFilesystem } from "../../core/filesystem/hooks";
import { useActiveFile, useMediaUrl, report } from "../../core/media/hooks";
import { useMediaState, clock, editableTarget } from "../../core/media/state";
export default function Cinema() {
  const { entries } = useFilesystem(),
    [id, select] = useActiveFile();
  const entry = entries.find((e) => e.id === id && !e.trashed);
  const media = useMediaUrl(entry),
    meta = useMediaState();
  const video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLDivElement>(null),
    subtitle = useRef<HTMLInputElement>(null),
    track = useRef<HTMLTrackElement>(null),
    lastSave = useRef(0),
    hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(Number(meta.preferences.volume ?? 0.7)),
    [muted, setMuted] = useState(false),
    [speed, setSpeed] = useState(1),
    [queue, setQueue] = useState<string[]>([]),
    [resume, setResume] = useState(0),
    [error, setError] = useState(""),
    [subUrl, setSubUrl] = useState(""),
    [subName, setSubName] = useState(""),
    [captions, setCaptions] = useState(true),
    [controls, setControls] = useState(true),
    [theater, setTheater] = useState(false);
  useEffect(() => {
    const v = video.current;
    return () => {
      v?.pause();
    };
  }, [id]);
  const list = queue.length
    ? queue
    : entries.filter((e) => matches(e, "cinema")).map((e) => e.id);
  const persist = () => {
    const v = video.current;
    if (id && v && v.currentTime > 0)
      meta.progressFor(id, {
        position: v.currentTime,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        opened: Date.now(),
      });
  };
  useEffect(() => {
    const v = video.current;
    return () => {
      if (id && v && v.currentTime > 0)
        useMediaState.getState().progressFor(id, {
          position: v.currentTime,
          duration: Number.isFinite(v.duration) ? v.duration : 0,
          opened: Date.now(),
        });
    };
  }, [id]);
  useEffect(
    () => () => {
      if (subUrl) URL.revokeObjectURL(subUrl);
    },
    [subUrl],
  );
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );
  useEffect(() => {
    const v = video.current;
    if (v) {
      v.volume = Math.min(1, Math.max(0, volume));
      v.muted = muted;
      v.playbackRate = speed;
    }
  }, [volume, muted, speed, id]);
  const show = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 2500);
  };
  const toggle = () => {
    const v = video.current;
    if (v?.paused)
      void v
        .play()
        .catch((e) =>
          setError("Playback was blocked or the file is unsupported. " + e),
        );
    else v?.pause();
    show();
  };
  const next = (delta: number) => {
    persist();
    const i = list.indexOf(id) + delta;
    if (list[i]) {
      select(list[i]);
      setSubUrl("");
      setError("");
    }
  };
  const seek = (offset: number) => {
    if (video.current)
      video.current.currentTime = Math.max(
        0,
        Math.min(duration, video.current.currentTime + offset),
      );
    show();
  };
  return (
    <div
      className="media-app"
      tabIndex={0}
      onKeyDown={(e) => {
        if (editableTarget(e.target)) return;
        if (e.code === "Space") {
          e.preventDefault();
          toggle();
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          seek(e.key === "ArrowRight" ? 10 : -10);
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setVolume((v) =>
            Math.max(0, Math.min(1, v + (e.key === "ArrowUp" ? 0.1 : -0.1))),
          );
        }
        if (e.key.toLowerCase() === "m") setMuted(!muted);
        if (e.key.toLowerCase() === "f")
          void stage.current?.requestFullscreen().catch(report);
      }}
    >
      {!id && (
        <Library
          kind="cinema"
          onOpen={(e, ids) => {
            setQueue(ids);
            select(e.id);
          }}
          onQueue={(id) => setQueue((q) => [...q, id])}
        />
      )}
      {id && (
        <>
          <header className="media-topbar">
            <button
              onClick={() => {
                persist();
                select("");
              }}
            >
              <ArrowLeft size={16} />
              Library
            </button>
            <strong>{entry?.name || "Unavailable video"}</strong>
            <button onClick={() => setTheater(!theater)}>
              {theater ? "Show details" : "Theater"}
            </button>
            <button onClick={() => subtitle.current?.click()}>
              Load WebVTT
            </button>
            {subUrl && (
              <button
                aria-pressed={captions}
                onClick={() => {
                  setCaptions(!captions);
                  if (track.current)
                    track.current.track.mode = captions
                      ? "disabled"
                      : "showing";
                }}
              >
                {captions ? "Hide" : "Show"} {subName}
              </button>
            )}
            <input
              hidden
              ref={subtitle}
              type="file"
              accept=".vtt,text/vtt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 2 * 1024 * 1024)
                    throw Error("Subtitles must be below 2 MB.");
                  const text = await f.text();
                  if (!text.trimStart().startsWith("WEBVTT"))
                    throw Error("Choose a valid WebVTT file.");
                  setSubUrl(
                    URL.createObjectURL(new Blob([text], { type: "text/vtt" })),
                  );
                  setSubName(f.name);
                  setCaptions(true);
                } catch (e) {
                  report(e);
                }
              }}
            />
          </header>
          {(error || media.error || !entry) && (
            <div role="alert" className="media-error">
              {error || media.error || "This video is missing or in Trash."}
            </div>
          )}
          <div className="cinema-stage" ref={stage} onPointerMove={show}>
            <video
              ref={video}
              src={media.url || undefined}
              preload="metadata"
              onClick={toggle}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                setPlaying(false);
                persist();
              }}
              onLoadedMetadata={() => {
                const v = video.current!;
                setDuration(v.duration);
                setTime(0);
                const p = meta.progress[id];
                setResume(
                  p && p.position > 5 && p.position < v.duration - 10
                    ? p.position
                    : 0,
                );
              }}
              onDurationChange={() => {
                const v = video.current;
                if (v && Number.isFinite(v.duration)) setDuration(v.duration);
              }}
              onTimeUpdate={() => {
                setTime(video.current!.currentTime);
                if (Date.now() - lastSave.current > 5000) {
                  lastSave.current = Date.now();
                  persist();
                }
              }}
              onEnded={() => {
                persist();
                next(1);
              }}
              onError={() =>
                setError(
                  "This video could not be decoded. Try MP4 (H.264) or WebM supported by your browser.",
                )
              }
            >
              {subUrl && (
                <track
                  key={subUrl}
                  ref={track}
                  kind="subtitles"
                  src={subUrl}
                  label={subName}
                  srcLang="en"
                  default
                />
              )}
            </video>
            {!!resume && (
              <div className="resume-prompt">
                Continue from {clock(resume)}?{" "}
                <button
                  onClick={() => {
                    if (video.current) video.current.currentTime = resume;
                    setResume(0);
                    toggle();
                  }}
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    setResume(0);
                    toggle();
                  }}
                >
                  Start over
                </button>
              </div>
            )}
            <div
              className={
                "cinema-controls " +
                (!controls && playing ? "hidden-controls" : "")
              }
            >
              <input
                className="seek"
                aria-label="Seek video"
                type="range"
                min="0"
                max={duration || 1}
                step=".1"
                value={Math.min(time, duration || 1)}
                onChange={(e) => {
                  if (video.current)
                    video.current.currentTime = Number(e.target.value);
                }}
              />
              <button aria-label="Previous video" onClick={() => next(-1)}>
                <SkipBack size={17} />
              </button>
              <button aria-label="Back 10 seconds" onClick={() => seek(-10)}>
                -10
              </button>
              <button
                aria-label={playing ? "Pause video" : "Play video"}
                onClick={toggle}
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button aria-label="Forward 10 seconds" onClick={() => seek(10)}>
                +10
              </button>
              <button aria-label="Next video" onClick={() => next(1)}>
                <SkipForward size={17} />
              </button>
              <span>
                {clock(time)} / {clock(duration)}
              </span>
              <button aria-label="Mute video" onClick={() => setMuted(!muted)}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                aria-label="Video volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  meta.preference("volume", Number(e.target.value));
                }}
                style={{ width: 70 }}
              />
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
              <button
                aria-label="Fullscreen video"
                onClick={() =>
                  void stage.current?.requestFullscreen().catch(report)
                }
              >
                <Maximize size={17} />
              </button>
              {document.pictureInPictureEnabled && (
                <button
                  aria-label="Picture in picture"
                  onClick={() =>
                    void video.current?.requestPictureInPicture().catch(report)
                  }
                >
                  <PictureInPicture size={17} />
                </button>
              )}
            </div>
          </div>
          {!theater && (
            <footer className="media-status">
              <span>
                {entry?.name} / {entry?.extension.toUpperCase()} / {list.length}{" "}
                in queue
              </span>
              <span>Space play/pause / Left-Right seek / F fullscreen</span>
            </footer>
          )}
        </>
      )}
    </div>
  );
}
