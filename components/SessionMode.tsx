import React, { useEffect, useMemo, useState } from "react";
import { AppState, Contact } from "../types";
import { Button } from "./ui/Button";
import { logger } from "../utils/logger";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  X,
  Send,
  SkipForward,
  Check,
  Phone,
  Share2,
  MessageSquare,
  List,
  Search,
  Ghost,
} from "lucide-react";

interface SessionModeProps {
  appState: AppState;
  dispatch: React.Dispatch<any>;
}

export const SessionMode: React.FC<SessionModeProps> = ({
  appState,
  dispatch,
}) => {
  const [showList, setShowList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter only selected contacts
  const activeContacts = useMemo(
    () => appState.contacts.filter((c) => c.selected),
    [appState.contacts]
  );

  // Initialize index if needed
  useEffect(() => {
    if (appState.currentContactIndex === -1 && activeContacts.length > 0) {
      dispatch({ type: "SET_CONTACT_INDEX", payload: 0 });
    }
  }, [activeContacts.length]);

  const currentContact =
    appState.currentContactIndex >= 0
      ? activeContacts[appState.currentContactIndex]
      : undefined;

  // Calculate progress
  const progress =
    activeContacts.length > 0 && appState.currentContactIndex >= 0
      ? (appState.currentContactIndex / activeContacts.length) * 100
      : 0;

  // Auto-redirect to summary if done
  useEffect(() => {
    if (
      appState.currentContactIndex >= 0 &&
      appState.currentContactIndex >= activeContacts.length
    ) {
      dispatch({ type: "SET_STEP", payload: "summary" });
    }
  }, [appState.currentContactIndex, activeContacts.length, dispatch]);

  const getFormattedNumber = (num: string) => {
    let clean = num.replace(/[^0-9]/g, "");
    if (appState.defaultCountryCode && !clean.startsWith(appState.defaultCountryCode)) {
      if (clean.startsWith("0")) clean = clean.substring(1);
      return appState.defaultCountryCode + clean;
    }
    return clean;
  };

  const handleSendText = () => {
    if (!currentContact) return;
    const msg = appState.messageTemplate.replace(
      /{name}/g,
      currentContact.name
    );
    const finalNumber = getFormattedNumber(currentContact.number);
    const url = `https://wa.me/${finalNumber}?text=${encodeURIComponent(msg)}`;
    logger.info(`Opening WhatsApp for ${currentContact.name}`);
    window.open(url, "_blank");
  };

  const handleShareFile = async () => {
    if (!currentContact || !appState.attachment) return;

    const msg = appState.messageTemplate.replace(
      /{name}/g,
      currentContact.name
    );

    // Try Web Share API first (modern browsers)
    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [appState.attachment.file] })
      ) {
        await navigator.share({ files: [appState.attachment.file], text: msg });
        logger.success("Opened share sheet (Web Share API)");
        return;
      }
    } catch (e) {
      logger.info(
        "Web Share API unavailable or failed, falling back to native share."
      );
    }

    // If running in Capacitor native (Android/iOS), use native Share + Filesystem
    if (Capacitor.isNativePlatform() && appState.attachment.file) {
      try {
        const file: File = appState.attachment.file as File;
        const arrayBuffer = await file.arrayBuffer();
        // Convert ArrayBuffer -> base64 in chunks to avoid call stack overflow for large files
        const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
          const bytes = new Uint8Array(buffer);
          const chunkSize = 0x8000; // 32KB
          let binary = "";
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          return btoa(binary);
        };

        const base64 = arrayBufferToBase64(arrayBuffer);
        const sharedPath = `shared/${file.name}`;

        // Ensure the parent folder exists in the Cache directory
        try {
          await Filesystem.mkdir({
            path: "shared",
            directory: Directory.Cache,
            recursive: true,
          });
        } catch (e) {
          // ignore if it already exists or if mkdir is unsupported
        }

        await Filesystem.writeFile({
          path: sharedPath,
          data: base64,
          directory: Directory.Cache,
        });
        const uriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path: sharedPath,
        });
        const fileUri = uriResult.uri;

        await Share.share({ title: file.name, text: msg, url: fileUri });
        logger.success("Opened native share sheet via Capacitor");
        return;
      } catch (err) {
        console.error(err);
        logger.error("Native share fallback failed");
        alert(
          "File sharing failed on this device. Please ensure the Capacitor Share & Filesystem plugins are installed and synced."
        );
        return;
      }
    }

    logger.error("File sharing is not supported on this device/browser");
    alert("Native file sharing is not supported in this environment.");
  };

  const next = (status: Contact["status"]) => {
    if (!currentContact) return;
    // Send ID, not index, because we are using a filtered list but updating the global list
    dispatch({
      type: "UPDATE_CONTACT_STATUS",
      payload: { id: currentContact.id, status },
    });

    // Check if there is a next contact
    if (appState.currentContactIndex + 1 < activeContacts.length) {
      dispatch({ type: "NEXT_CONTACT" });
    } else {
      dispatch({ type: "SET_STEP", payload: "summary" });
    }
  };

  const jumpTo = (index: number) => {
    dispatch({ type: "SET_CONTACT_INDEX", payload: index });
    setShowList(false);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in relative bg-zinc-50 dark:bg-zinc-950">
      {/* Contact List Drawer/Modal */}
      {(showList || !currentContact) && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col animate-slide-up">
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-900">
            <h3 className="font-bold text-lg">
              Send Queue ({activeContacts.length})
            </h3>
            {currentContact && (
              <button
                onClick={() => setShowList(false)}
                className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {activeContacts.map((c, idx) => {
              if (
                searchQuery &&
                !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !c.number.includes(searchQuery)
              )
                return null;
              const isActive = idx === appState.currentContactIndex;
              return (
                <button
                  key={c.id}
                  onClick={() => jumpTo(idx)}
                  className={`w-full flex items-center p-3 rounded-xl border transition-all ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm truncate ${
                        isActive
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-zinc-900 dark:text-white"
                      }`}
                    >
                      {c.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500 font-mono truncate">
                        {c.number}
                      </p>
                      {c.status === "sent" && (
                        <Check size={12} className="text-emerald-500" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Strip */}
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800 w-full flex-none">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top Controls */}
      <div className="flex-none px-6 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={() =>
            confirm("Exit session?") &&
            dispatch({ type: "SET_STEP", payload: "compose" })
          }
          className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        <div className="flex gap-2">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
            {currentContact ? appState.currentContactIndex + 1 : 0} /{" "}
            {activeContacts.length}
          </div>
          <button
            onClick={() => setShowList(true)}
            className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 border border-zinc-200 dark:border-zinc-800"
          >
            <List size={14} /> <span className="text-xs font-bold">List</span>
          </button>
        </div>
        <div className="w-8" />
      </div>

      {/* Content - Only render if currentContact exists */}
      {currentContact ? (
        <>
          {/* Main Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center">
             <div className="w-full max-w-sm flex flex-col items-center gap-4 my-auto">
                <div className="relative w-full">
                  {/* Decoration Card Behind */}
                  <div className="absolute top-4 left-4 right-4 bottom-[-10px] bg-white dark:bg-zinc-900 rounded-[2.5rem] scale-95 opacity-50 -z-10 border border-zinc-100 dark:border-zinc-800" />

                  {/* Main Card */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-6 sm:p-8 shadow-xl flex flex-col items-center text-center">
                    {/* Avatar */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/20 flex items-center justify-center mb-5 shadow-inner ring-4 ring-white dark:ring-zinc-950">
                      <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                        {currentContact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 line-clamp-1 break-all px-2">
                      {currentContact.name}
                    </h2>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm font-mono mb-4">
                      <Phone size={12} />
                      {currentContact.number}
                    </div>

                    {/* Attachment Indicator */}
                    {appState.attachment && (
                      <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-100 dark:border-blue-800">
                        <Share2 size={12} />
                        <span>
                          Including{" "}
                          {appState.attachment.type.startsWith("image/")
                            ? "Image"
                            : "File"}
                        </span>
                      </div>
                    )}

                    {/* Message Preview */}
                    <div className="w-full bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-4 text-left mb-2 relative group border border-zinc-100 dark:border-zinc-800/50">
                      <div className="absolute -top-2.5 left-4 px-1.5 bg-white dark:bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Preview
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                        {appState.messageTemplate.replace(
                          /{name}/g,
                          currentContact.name
                        )}
                      </p>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Bottom Actions - Fixed/Flex-none */}
          <div className="flex-none p-6 pt-2 space-y-3 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm safe-bottom z-10">
            {appState.attachment ? (
              <div className="space-y-3">
                <Button
                  onClick={handleShareFile}
                  size="xl"
                  fullWidth
                  className="bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 shadow-lg border-none"
                >
                  <Share2 size={24} className="mr-2" /> Share File & Text
                </Button>
                <Button
                  onClick={handleSendText}
                  size="lg"
                  fullWidth
                  variant="secondary"
                  className="bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200"
                >
                  <MessageSquare size={18} className="mr-2" /> Send Text Only
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleSendText}
                size="xl"
                fullWidth
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-green-500/20 shadow-lg border-none"
              >
                <Send size={24} className="mr-2" /> Open WhatsApp
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => next("skipped")}
                variant="secondary"
                size="lg"
                className="rounded-2xl"
              >
                <SkipForward size={20} className="mr-2 text-zinc-400" /> Skip
              </Button>
              <Button
                onClick={() => next("sent")}
                variant="primary"
                size="lg"
                className="bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 rounded-2xl shadow-none"
              >
                <Check size={20} className="mr-2" /> Mark Sent
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
            <Ghost size={32} className="text-zinc-400" />
          </div>
          <p className="text-zinc-500">Queue is empty...</p>
        </div>
      )}
    </div>
  );
};
