export type RefineResult = {
  markdown: string
  model: string
  provider: string
}

export interface AiProvider {
  refine(sourceText: string): Promise<RefineResult>
}
