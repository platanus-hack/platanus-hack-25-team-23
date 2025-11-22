import { z } from 'zod'

export const noteSchema = z.object({
  title: z.string().describe("The title of the note"),
  content: z.string().describe("The markdown content of the note. Must include [[linked terms]] and callouts."),
  linkedTerms: z.array(z.string()).describe("List of terms that are linked in the content"),
  prerequisites: z.array(z.string()).describe("List of prerequisite topics"),
  nextSteps: z.array(z.string()).describe("List of recommended next topics"),
})

export type NoteData = z.infer<typeof noteSchema>
