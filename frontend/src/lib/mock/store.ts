import { useSyncExternalStore } from "react"

import type { CaseStatus, FraudCase } from "@/types/fraud"

import { seedCases } from "./seed-cases"

const STORAGE_KEY = "netrax.cases.v1"

function loadInitial(): FraudCase[] {
  if (typeof window === "undefined") return seedCases
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedCases
    const parsed = JSON.parse(raw) as FraudCase[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedCases
  } catch {
    return seedCases
  }
}

let cases: FraudCase[] = loadInitial()
const listeners = new Set<() => void>()

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
    } catch {
      // ignore quota / privacy-mode errors — in-memory state still updates
    }
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return cases
}

export function addCase(fraudCase: FraudCase) {
  cases = [fraudCase, ...cases]
  emit()
}

export function updateCaseStatus(id: string, status: CaseStatus) {
  cases = cases.map((c) => (c.id === id ? { ...c, status } : c))
  emit()
}

export function toggleSaved(id: string) {
  cases = cases.map((c) => (c.id === id ? { ...c, savedByMe: !c.savedByMe } : c))
  emit()
}

export function toggleWatchlisted(id: string) {
  cases = cases.map((c) => (c.id === id ? { ...c, watchlisted: !c.watchlisted } : c))
  emit()
}

export function getCaseById(id: string): FraudCase | undefined {
  return cases.find((c) => c.id === id)
}

export function useCases(): FraudCase[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => seedCases)
}

export function useCase(id: string | undefined): FraudCase | undefined {
  const all = useCases()
  return all.find((c) => c.id === id)
}
