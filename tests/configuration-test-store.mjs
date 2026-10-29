export const configurationTestStore = {
  name: 'configuration-test-store',
  setup(builder) {
    builder.onLoad({ filter: /configurationStore\.ts$/ }, () => ({
      contents: `
        const values = globalThis.__configurationTestValues ??= new Map();
        export const readConfiguration = key => values.get(key);
        export const writeConfiguration = async (key, value) => { values.set(key, structuredClone(value)); };
      `,
      loader: 'js',
    }));
  },
};
