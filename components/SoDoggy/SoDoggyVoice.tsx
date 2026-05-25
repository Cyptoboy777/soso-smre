"use client";

import SoDoggyAvatar from "./SoDoggyAvatar";
import useSpeech from "./hooks/useSpeech";

export default function SoDoggyVoice() {
  const { speak, speaking } = useSpeech();

  return (
    <div>
      <SoDoggyAvatar speaking={speaking} />

      <button
        onClick={() =>
          speak(
            "Ruh-roh! Bitcoin pumping hard today boss!",
            "excited"
          )
        }
      >
        Talk
      </button>
    </div>
  );
}
