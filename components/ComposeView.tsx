import React, { useRef } from "react";
import { AppState } from "../types";
import { Button } from "./ui/Button";
import {
  ArrowRight,
  Wand2,
  Paperclip,
  X,
  Image as ImageIcon,
  Hand,
  Users,
} from "lucide-react";

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
}

export const ComposeView: React.FC<Props> = ({ state, dispatch }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      dispatch({
        type: "SET_ATTACHMENT",
        payload: {
          name: file.name,
          type: file.type,
          file,
          previewUrl: URL.createObjectURL(file),
        },
      });
    }
  };

  const insertVariable = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = state.messageTemplate;
      const newText = text.substring(0, start) + "{name}" + text.substring(end);
      dispatch({ type: "SET_MESSAGE", payload: newText });
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const selectedCount = state.contacts.filter((c) => c.selected).length;
  const isValid =
    selectedCount > 0 &&
    (state.messageTemplate.trim().length > 0 || state.attachment !== null);

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Scrollable Editor Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 pb-48">
        <div className="flex-none flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
              Craft Message
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Personalize your blast. Attach media if needed.
            </p>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
              <Users size={14} />
              <span className="text-xs font-bold">
                {selectedCount} Selected
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col relative focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all shadow-sm min-h-[250px]">
          {/* Toolbar */}
          <div className="h-12 border-b border-zinc-100 dark:border-zinc-800 flex items-center px-2 gap-2 bg-zinc-50 dark:bg-zinc-900/50 flex-none">
            <button
              onClick={insertVariable}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm"
            >
              <Wand2 size={12} /> {"{name}"}
            </button>
            <div className="flex-1" />
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-lg transition-colors ${
                state.attachment
                  ? "text-emerald-500 bg-emerald-500/10"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Paperclip size={18} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={state.messageTemplate}
            onChange={(e) =>
              dispatch({ type: "SET_MESSAGE", payload: e.target.value })
            }
            placeholder="Hi {name}, check this out..."
            className="flex-1 w-full bg-transparent p-4 text-base text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none resize-none custom-scrollbar leading-relaxed"
          />

          {/* Attachment Preview Overlay */}
          {state.attachment && (
            <div className="absolute bottom-44 left-4 right-4 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-lg p-3 flex items-center gap-3 border border-zinc-200 dark:border-zinc-700 animate-slide-up shadow-lg">
              <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-black/50 flex items-center justify-center overflow-hidden">
                {state.attachment.type.startsWith("image") ? (
                  <img
                    src={state.attachment.previewUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={20} className="text-zinc-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {state.attachment.name}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase">
                  {state.attachment.type.split("/")[1]}
                </p>
              </div>
              <button
                onClick={() =>
                  dispatch({ type: "SET_ATTACHMENT", payload: null })
                }
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
              >
                <X size={16} className="text-zinc-500" />
              </button>
            </div>
          )}
        </div>

        {selectedCount === 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-200 dark:border-red-900/50 text-center mb-32">
            Please select at least one contact in step 1 to proceed.
          </div>
        )}
      </div>

      {/* Fixed Bottom Action */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent flex flex-col sm:flex-row gap-3 z-30 safe-bottom">
        <Button
          fullWidth
          size="xl"
          variant="secondary"
          disabled={!isValid}
          onClick={() => dispatch({ type: "SET_STEP", payload: "manual" })}
          className="dark:bg-zinc-900"
        >
          <Hand size={20} className="mr-2 text-zinc-500" /> Manual Mode
        </Button>
        <Button
          fullWidth
          size="xl"
          disabled={!isValid}
          onClick={() => dispatch({ type: "SET_STEP", payload: "running" })}
        >
          Auto Run <ArrowRight size={20} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};
