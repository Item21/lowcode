import { Resolver } from '@velcro/resolver';
import { CdnStrategy } from '@velcro/strategy-cdn';
import { GraphBuilder } from '@velcro/bundler';
import { sucrasePlugin } from '@velcro/plugin-sucrase';
import { cssPlugin } from '@velcro/plugin-css';
import dependencyFetcher from './util/dependencyFetcher';

export async function cdnImports(source: string): Promise<string> {
  const regexFrom = source.match(/from[ ]*(["'"])([^.][^"'"]+)["'"]/gm);
  const regexImport = source.match(/import[ ]*(["'"])([^.][^"'"]+)["'"]/gm);
  if (regexFrom?.length) {
    for (let i = 0; i < regexFrom.length; i++) {
      console.log(regexFrom[i]);
      const string = regexFrom[i].match(/(["'])(?:(?=(\\?))\2.)*?\1/gm);
      if (string) {
        const dependency = string[0].replaceAll('"', '').replaceAll("'", '');
        const replaceString = await dependencyFetcher(dependency);
        return source.replace(regexFrom[i], `from "${replaceString}"`);
      }
    }
  }

  if (regexImport?.length) {
    for (let i = 0; i < regexImport.length; i++) {
      const string = regexImport[0].match(/(["'])(?:(?=(\\?))\2.)*?\1/gm);
      if (string) {
        const dependency = string[0].replaceAll('"', '').replaceAll("'", '');
        const replaceString = await dependencyFetcher(dependency);
        return source.replace(regexImport[i], `import  "${replaceString}"`);
      }
    }
  }
  return source;
}
export async function dependency(pkgName: string) {
  const readUrl = (href: string) =>
    fetch(href).then((res) => res.arrayBuffer());
  const unpkgStrategy = CdnStrategy.forUnpkg(readUrl);
  //const jsdelivrStrategy = CdnStrategy.forJsDelivr(readUrl);
  //const memoryStrategy = new MemoryStrategy({});
  //const compoundStrategy = new CompoundStrategy({ strategies: [unpkgStrategy, jsdelivrStrategy, memoryStrategy] });
  const resolver = new Resolver(unpkgStrategy, {
    extensions: ['.js' /*, '.jsx', '.json', '.ts', '.tsx', '.mjs', '.cjs'*/],
    packageMain: ['browser', 'main'],
  });
  const graphBuilder = new GraphBuilder({
    resolver,
    nodeEnv: 'development',
    plugins: [
      cssPlugin(),
      sucrasePlugin({ transforms: ['imports' /*, 'jsx', 'typescript'*/] }),
    ],
  });
  const cdnUri = 'https://unpkg.com/' + pkgName;
  const build = graphBuilder.build([cdnUri]);
  //console.log('build', build)

  const graph = await build.done;
  const [chunk] = graph.splitChunks();
  //console.log('build chunk', chunk)
  const output = chunk.buildForStaticRuntime({
    injectRuntime: true, //buildId === 0,
  });
  //console.log('build output', output)
  const codeWithStart = `${output.code}\n\n${output.entrypoints
    .map(
      (entrypoint) =>
        `Velcro.runtime.require(${JSON.stringify(entrypoint.toString())});`,
    )
    .join('\n')}\n`;
  const runtimeCode = `${codeWithStart}\n//# sourceMappingURL=${output.sourceMapDataUri}`;
  //console.log('build runtimeCode', runtimeCode)

  return { code: runtimeCode, path: cdnUri };
}
