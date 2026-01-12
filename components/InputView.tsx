import React, { useState, useMemo } from "react";
import { AppState } from "../types";
import { Button } from "./ui/Button";
import {
  Trash2,
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  Smartphone,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";

interface Props {
  state: AppState;
  dispatch: React.Dispatch<any>;
  onRetryLoad: () => void;
}

export const InputView: React.FC<Props> = ({
  state,
  dispatch,
  onRetryLoad,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter logic
  const filteredContacts = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();

    if (!rawQuery) return state.contacts;

    // 1. Prepare for Name Search (Tokenized)
    // "Bob Smith" -> ["bob", "smith"]
    // Matches if ALL tokens are present in the name (order independent)
    const tokens = rawQuery.split(/\s+/).filter((t) => t.length > 0);

    // 2. Prepare for Number Search (Cleaned)
    const cleanQuery = rawQuery.replace(/[^0-9]/g, "");

    // STRICTER RULE: Only search phone numbers if the user has typed at least 3 digits.
    // This prevents searching for "1" from matching 90% of your contact list.
    const shouldCheckNumber = cleanQuery.length >= 3;

    return state.contacts.filter((c) => {
      // A) Name Match: Check if every typed word exists in the contact name
      const name = c.name.toLowerCase();
      const nameMatch =
        tokens.length > 0 && tokens.every((token) => name.includes(token));

      // B) Number Match: strict substring match on cleaned numbers
      const numberMatch = shouldCheckNumber && c.number.includes(cleanQuery);

      return nameMatch || numberMatch;
    });
  }, [state.contacts, searchQuery]);

  const selectedCount = state.contacts.filter((c) => c.selected).length;
  const totalCount = state.contacts.length;
  const isAllSelected = totalCount > 0 && selectedCount === totalCount;

  const toggleSelectAll = () => {
    // If filtering, we only toggle the visible ones?
    // Requirement is usually "Select All" applies to the current view or all?
    // "Select & Send" usually implies selecting from the list.
    // If a search is active, "Select All" usually selects the filtered results.
    // Let's make it smart: If search is active, toggle only filtered. If cleared, toggle all.

    const targetIds = filteredContacts.map((c) => c.id);
    const allFilteredAreSelected =
      filteredContacts.length > 0 && filteredContacts.every((c) => c.selected);

    // We can't use the simple TOGGLE_ALL_SELECTION payload for filtered lists easily without a new action,
    // or we iterate. For simplicity and robustness, let's iterate dispatch or add a specific action.
    // Given the constraints, let's just toggle individually or use the bulk toggle if no search.

    if (searchQuery.trim() === "") {
      dispatch({ type: "TOGGLE_ALL_SELECTION", payload: !isAllSelected });
    } else {
      // Bulk toggle for filtered list
      // We will simulate this by iterating, or ideally adding a BULK_TOGGLE action.
      // For now, let's just iterate to be safe and compatible with existing reducer.
      // Optimization: If list is huge, this is slow, but for <5000 contacts it's instant.
      targetIds.forEach((id) => {
        // If we are selecting all, set selected. If deselecting, set unselected.
        // But we need to check the current state of "allFilteredAreSelected"
        // If ALL filtered are selected -> Deselect them.
        // If SOME or NONE are selected -> Select them.

        // This requires we know the specific target state.
        const shouldSelect = !allFilteredAreSelected;

        // We only need to dispatch if the state is different
        const contact = filteredContacts.find((c) => c.id === id);
        if (contact && contact.selected !== shouldSelect) {
          dispatch({ type: "TOGGLE_CONTACT_SELECTION", payload: id });
        }
      });
    }
  };

  const isAllFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every((c) => c.selected);

  const hasContacts = state.contacts.length > 0;

  // --- RENDER STATES ---

  if (state.isLoadingContacts) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-center animate-fade-in">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
          Syncing Contacts
        </h3>
        <p className="text-zinc-500 mt-2">Importing from your phonebook...</p>
      </div>
    );
  }

  if (state.permissionStatus === "denied" && Capacitor.isNativePlatform()) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6 ring-4 ring-red-50 dark:ring-red-900/20">
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          Access Needed
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto">
          To send messages, WhatsFlow needs access to your contacts. Please
          grant permission in your settings or try again.
        </p>
        <Button onClick={onRetryLoad} size="lg">
          Grant Permission
        </Button>
      </div>
    );
  }

  if (!state.isLoadingContacts && !hasContacts) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
          <Smartphone size={32} className="text-zinc-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          No Contacts Found
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-xs mx-auto">
          We couldn't find any contacts with phone numbers on this device.
        </p>
        <Button onClick={onRetryLoad} variant="secondary" size="lg">
          Try Reloading
        </Button>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="h-full flex flex-col animate-fade-in relative bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-none px-6 pt-6 pb-2 bg-white dark:bg-zinc-950 z-10">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Select Recipients
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {searchQuery
                ? `Found ${filteredContacts.length} contacts`
                : "Select who should receive the message."}
            </p>
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 transition-colors flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            {/* Visual state depends on whether we are filtering or not */}
            {(searchQuery ? isAllFilteredSelected : isAllSelected) ? (
              <CheckSquare size={16} />
            ) : (
              <Square size={16} />
            )}
            {(searchQuery ? isAllFilteredSelected : isAllSelected)
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        <div className="relative mt-2">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or number..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 pb-44 space-y-2 custom-scrollbar">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-10 text-zinc-400">
            <p>No contacts match "{searchQuery}"</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() =>
                dispatch({
                  type: "TOGGLE_CONTACT_SELECTION",
                  payload: contact.id,
                })
              }
              className={`flex items-center justify-between p-3 border rounded-xl shadow-sm transition-all cursor-pointer group active:scale-[0.99] ${
                contact.selected
                  ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
                  : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Checkbox Visual */}
                <div
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                    contact.selected
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {contact.selected && (
                    <CheckSquare size={14} className="fill-current" />
                  )}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold shrink-0 text-zinc-500 text-sm">
                  {contact.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p
                    className={`font-semibold truncate text-sm ${
                      contact.selected
                        ? "text-emerald-900 dark:text-emerald-100"
                        : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {contact.name}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono truncate">
                    {contact.number}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        {/* Spacer */}
        <div className="h-24" />
      </div>

      {/* Fixed Bottom Action */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-zinc-950 via-white/90 dark:via-zinc-950/90 to-transparent z-20 safe-bottom">
        <Button
          fullWidth
          size="xl"
          onClick={() => dispatch({ type: "SET_STEP", payload: "compose" })}
          disabled={selectedCount === 0}
          className="shadow-xl shadow-emerald-500/20 flex items-center justify-between px-6"
        >
          <span className="font-normal opacity-90">
            {selectedCount} Selected
          </span>
          <span className="flex items-center font-bold">
            Compose <ArrowRight size={20} className="ml-2" />
          </span>
        </Button>
      </div>
    </div>
  );
};
