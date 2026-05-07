import { create } from 'zustand'

interface UiState {
  selectedRequestIds: Set<string>
  isRejectModalOpen: boolean
  rejectTargetId: string | null
  isEscalateModalOpen: boolean
  escalateTargetId: string | null

  toggleRequestSelection: (id: string) => void
  selectAllRequests: (ids: string[]) => void
  clearRequestSelection: () => void

  openRejectModal: (requestId: string) => void
  closeRejectModal: () => void

  openEscalateModal: (requestId: string) => void
  closeEscalateModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  selectedRequestIds: new Set(),
  isRejectModalOpen: false,
  rejectTargetId: null,
  isEscalateModalOpen: false,
  escalateTargetId: null,

  toggleRequestSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedRequestIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedRequestIds: next }
    }),

  selectAllRequests: (ids) =>
    set({ selectedRequestIds: new Set(ids) }),

  clearRequestSelection: () =>
    set({ selectedRequestIds: new Set() }),

  openRejectModal: (requestId) =>
    set({ isRejectModalOpen: true, rejectTargetId: requestId }),

  closeRejectModal: () =>
    set({ isRejectModalOpen: false, rejectTargetId: null }),

  openEscalateModal: (requestId) =>
    set({ isEscalateModalOpen: true, escalateTargetId: requestId }),

  closeEscalateModal: () =>
    set({ isEscalateModalOpen: false, escalateTargetId: null }),
}))
