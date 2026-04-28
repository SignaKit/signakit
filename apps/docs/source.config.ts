import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config'
import lastModified from 'fumadocs-mdx/plugins/last-modified'
import type { ElementContent } from 'hast'
import { defaultShikiOptions } from '@/lib/shiki'
import type { ShikiTransformer } from 'shiki'
import type { RemarkAutoTypeTableOptions } from 'fumadocs-typescript'

export const docs = defineDocs({
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
      extractLinkReferences: true,
      valueToExport: ['elementIds'],
    },
    async: true,
    async mdxOptions(environment) {
      const { rehypeCodeDefaultOptions } = await import('fumadocs-core/mdx-plugins/rehype-code')
      const { remarkSteps } = await import('fumadocs-core/mdx-plugins/remark-steps')
      const { transformerTwoslash } = await import('fumadocs-twoslash')
      const { createFileSystemTypesCache } = await import('fumadocs-twoslash/cache-fs')
      const { default: remarkMath } = await import('remark-math')
      const { default: rehypeKatex } = await import('rehype-katex')
      const { remarkAutoTypeTable, createGenerator, createFileSystemGeneratorCache } =
        await import('fumadocs-typescript')

      const typeTableOptions: RemarkAutoTypeTableOptions = {
        generator: createGenerator({
          cache: createFileSystemGeneratorCache('.next/fumadocs-typescript'),
        }),
        shiki: defaultShikiOptions,
      }
      return applyMdxPreset({
        rehypeCodeOptions: {
          inline: 'tailing-curly-colon',
          themes: {
            light: 'catppuccin-latte',
            dark: 'catppuccin-mocha',
          },
          transformers: [
            ...(rehypeCodeDefaultOptions.transformers ?? []),
            transformerTwoslash({
              typesCache: createFileSystemTypesCache(),
              twoslashOptions: {
                compilerOptions: {
                  types: ['@types/node'],
                },
              },
            }),
            transformerEscape(),
          ],
        },
        remarkCodeTabOptions: {
          parseMdx: true,
        },
        remarkStructureOptions: {
          stringify: {
            filterElement(node) {
              switch (node.type) {
                case 'mdxJsxFlowElement':
                case 'mdxJsxTextElement':
                  switch (node.name) {
                    case 'File':
                    case 'TypeTable':
                    case 'Callout':
                    case 'Card':
                    case 'Custom':
                      return true
                  }
                  return 'children-only'
              }

              return true
            },
          },
        },
        remarkNpmOptions: {
          persist: {
            id: 'package-manager',
          },
        },
        remarkPlugins: [remarkSteps, remarkMath, [remarkAutoTypeTable, typeTableOptions]],
        rehypePlugins: (v) => [rehypeKatex, ...v],
      })(environment)
    },
  },
})

function transformerEscape(): ShikiTransformer {
  return {
    name: '@shikijs/transformers:remove-notation-escape',
    code(hast) {
      function replace(node: ElementContent) {
        if (node.type === 'text') {
          node.value = node.value.replace('[\\!code', '[!code')
        } else if ('children' in node) {
          for (const child of node.children) {
            replace(child)
          }
        }
      }

      replace(hast)
      return hast
    },
  }
}

export default defineConfig({
  mdxOptions: {},
  plugins: [lastModified()],
})
