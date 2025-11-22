import { MainLayout } from "@/components/layout/main-layout"
import { NotePanel } from "@/components/features/note-panel"
import { GraphPanel } from "@/components/features/graph-panel"
import { KnowledgeProvider } from "@/lib/store/knowledge-context"
import { Toaster } from "@/components/ui/sonner"

export default function Home() {
  return (
    <KnowledgeProvider>
      <MainLayout
        notePanel={<NotePanel />}
        graphPanel={<GraphPanel />}
      />
      <Toaster />
    </KnowledgeProvider>
  )
}
