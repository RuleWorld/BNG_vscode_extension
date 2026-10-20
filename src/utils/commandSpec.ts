export interface CommandSpec {
    command: string;
    args: string[];
}

export function createCommandSpec(command: string, args: readonly string[] = []): CommandSpec {
    return {
        command,
        args: [...args],
    };
}

export function appendCommandArgs(spec: CommandSpec, args: readonly string[]): CommandSpec {
    return {
        command: spec.command,
        args: [...spec.args, ...args],
    };
}

export function formatCommandSpec(spec: CommandSpec): string {
    return [spec.command, ...spec.args].map(quoteShellArg).join(' ');
}

function quoteShellArg(arg: string): string {
    if (arg.length === 0) {
        return '""';
    }

    if (!/[\s"'$`\\]/u.test(arg)) {
        return arg;
    }

    if (process.platform === 'win32') {
        return `"${arg.replace(/"/g, '""')}"`;
    }

    return `'${arg.replace(/'/g, `'\\''`)}'`;
}
