import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";

import type { SessionType } from "../../../constants/sessionTypes";

const SUGGESTED_TAGS = ["trap", "drill", "techno", "house", "experimental"];

export function useSessionSetupFields(initialSessionType: SessionType | null, t: TFunction) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(initialSessionType);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  // The session type can arrive after the first render (deep link, resumed draft). Adopting it
  // while rendering avoids the extra committed frame an effect would show the old selection for.
  const [adoptedSessionType, setAdoptedSessionType] = useState(initialSessionType);
  if (initialSessionType && initialSessionType !== adoptedSessionType) {
    setAdoptedSessionType(initialSessionType);
    setSelectedType(initialSessionType);
  }

  const addTag = useCallback(
    (rawTag: string) => {
      const tag = rawTag.trim().toLowerCase();
      if (!tag) return;
      if (tag.length > 32) return setTagError(t("sessionSetup.tagTooLong"));
      if (tags.length >= 20) return setTagError(t("sessionSetup.tagLimitReached"));
      if (tags.includes(tag)) return setTagError(t("sessionSetup.tagAlreadyAdded"));
      setTags((current) => [...current, tag]);
      setTagInput("");
      setTagError(null);
    },
    [t, tags],
  );
  return {
    selectedType,
    setSelectedType,
    notes,
    setNotes,
    mood,
    setMood,
    tags,
    removeTag: (tag: string) => setTags((current) => current.filter((item) => item !== tag)),
    tagInput,
    setTagInput,
    tagError,
    suggestedTags: useMemo(() => SUGGESTED_TAGS.filter((tag) => !tags.includes(tag)), [tags]),
    showOptional,
    toggleOptional: () => setShowOptional((current) => !current),
    addTag,
  };
}

export type SessionSetupFields = ReturnType<typeof useSessionSetupFields>;
