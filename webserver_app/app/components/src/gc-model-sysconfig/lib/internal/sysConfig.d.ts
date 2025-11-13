export interface Configurable {
    name: string;
}
export interface Instance {
    $module: Module;
    $name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [ name: string ]: Instance | any;
}
export interface Module {
    config: Array<Configurable>;
    $instances: Instance[];
}
export interface Modules {
    [ name: string ]: Module;
}
export interface SysConfigEnv {
    internals: {
        asyncChange(change: () => void): Promise<void>;
        asyncGenerate(templateName: string): Promise<string>;
        asyncGetTemplates(assumeNoErrors?: boolean): Promise<string[]>;
        asyncSerialize(scriptPath?: string): Promise<string>;
    };
    system: {
        modules: Modules;
        getOutputFiles(type: 'all' | 'generated' | 'referenced', outputDir?: string): string[];
    };
    scripting: unknown;
}
export function asyncCreateEnv(argv: string[], scriptSource?: string): Promise<SysConfigEnv>;

