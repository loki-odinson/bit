import Container from './container';
import Extension from './extension';
import { Graph } from '../r-graph';
import { ExtensionProvider, ProviderFn } from './extension.provider';
import DependencyGraph from './dependency-graph/dependency-graph';
import { AnyExtension } from './types';
import { fromExtensions } from './dependency-graph/from-extension';
import { ExtensionLoadError } from './exceptions';

async function asyncForEach(array, callback) {
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < array.length; index++) {
    // eslint-disable-next-line no-await-in-loop
    await callback(array[index], index, array);
  }
}

export default class Harmony {
  constructor(private graph: DependencyGraph) {}

  get extensions() {
    return this.graph.vertices.map(vertex => vertex.attr);
  }

  async load(extensions: AnyExtension[]) {
    this.graph.addExtensions(extensions);
    asyncForEach(extensions, async ext => this.runOne(ext));
  }

  async runOne(extension: AnyExtension) {
    if (extension.instance) return;
    // create an index of all vertices in dependency graph
    const dependencies = await Promise.all(
      extension.dependencies.map(async (ext: AnyExtension) => {
        return ext.instance;
      })
    );

    try {
      await extension.run(dependencies, this);
    } catch (err) {
      throw new ExtensionLoadError(extension, err);
    }
  }

  async run() {
    const executionOrder = this.graph.byExecutionOrder();
    await asyncForEach(executionOrder, async ext => {
      await this.runOne(ext);
    });
  }

  static load(extension: Extension<any, any>) {
    let graph: DependencyGraph | null = null;
    graph = DependencyGraph.fromRoot(extension);
    return new Harmony(graph!);
  }
}