// Loads html-to-image only when someone actually shares/saves a card, keeping it out of page bundles.
type Options = Parameters<typeof import('html-to-image').toPng>[1]

export async function toPng(node: HTMLElement, options?: Options): Promise<string> {
  const { toPng: render } = await import('html-to-image')
  return render(node, options)
}
