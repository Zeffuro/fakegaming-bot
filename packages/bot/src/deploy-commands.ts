import {REST} from 'discord.js';
import {Routes} from 'discord-api-types/rest/v10';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {bootstrapEnv} from '@zeffuro/fakegaming-common/core';
import { findCommandFiles } from './core/commandsFs.js';
import { BOT_COMMANDS } from '@zeffuro/fakegaming-common/manifest/bot-manifest';

const {__dirname} = bootstrapEnv(import.meta.url);

export async function deployCommands() {
    function findDuplicates(arr: { name: string }[]) {
        const seen = new Set<string>();
        return arr.filter(cmd => {
            if (seen.has(cmd.name)) return true;
            seen.add(cmd.name);
            return false;
        });
    }

    // Normalize a command object to the minimal comparable shape and strip volatile fields
    function normalizeCommand(cmd: any): Record<string, unknown> {
        if (!cmd || typeof cmd !== 'object') return {};
        const { id: _id, application_id: _application_id, version: _version, type: _type, guild_id: _guild_id, ...rest } = cmd as Record<string, unknown>;
        return rest;
    }

    function normalizeCommands(commands: object[]): object[] {
        return [...commands]
            .map((c) => normalizeCommand(c))
            .sort((a, b) => String((a as any).name).localeCompare(String((b as any).name)));
    }

    // Load implementation payloads from command files
    const modulesPath = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesPath)) {
        throw new Error(`Modules directory not found at ${modulesPath}`);
    }

    const commandFiles = findCommandFiles(modulesPath);
    const implByName = new Map<string, Record<string, unknown>>();
    for (const commandPath of commandFiles) {
        const commandModule = await import(pathToFileURL(commandPath).href);
        const cmd = commandModule.default;
        if (cmd?.data) {
            const json = cmd.data.toJSON() as Record<string, unknown>;
            const name = String(json.name ?? '');
            if (name) implByName.set(name, json);
        }
    }

    // Build registration sets using manifest as the single source of truth
    const globalCommands: object[] = [];
    const testCommands: object[] = [];

    for (const meta of BOT_COMMANDS) {
        const payload = implByName.get(meta.name);
        if (!payload) {
            throw new Error(`Implementation for command '${meta.name}' not found. Ensure a command file exists and matches the manifest name.`);
        }

        // Overlay registration fields from manifest if provided
        if (typeof meta.dm_permission === 'boolean') {
            (payload as any).dm_permission = meta.dm_permission;
        }
        if (meta.default_member_permissions != null) {
            (payload as any).default_member_permissions = meta.default_member_permissions;
        }

        if (meta.testOnly) {
            testCommands.push(payload);
        } else {
            globalCommands.push(payload);
            // Also include global in test (guild) set for faster propagation/testing
            testCommands.push(payload);
        }
    }

    const globalDupes = findDuplicates(globalCommands as any);
    const testDupes = findDuplicates(testCommands as any);
    if (globalDupes.length || testDupes.length) {
        throw new Error(
            `Duplicate command names found:\nGlobal: ${globalDupes.map((c: any) => c.name).join(', ')}\nTest: ${testDupes.map((c: any) => c.name).join(', ')}`
        );
    }

    const rest = new REST({version: '10'}).setToken(process.env.DISCORD_BOT_TOKEN!);

    function commandsAreDifferent(existing: object[], local: object[]) {
        const nExisting = normalizeCommands(existing);
        const nLocal = normalizeCommands(local);
        return JSON.stringify(nExisting) !== JSON.stringify(nLocal);
    }

    // Global commands
    const existingGlobal = await rest.get(
        Routes.applicationCommands(process.env.CLIENT_ID!)
    ) as object[];
    if (commandsAreDifferent(existingGlobal, globalCommands)) {
        const updatedGlobal = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            {body: globalCommands},
        );
        console.log('Accepted global commands:', updatedGlobal);
    } else {
        console.log('Global commands are up to date.');
    }

    // Guild commands
    if (process.env.GUILD_ID) {
        const existingGuild = await rest.get(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID)
        ) as object[];
        if (commandsAreDifferent(existingGuild, testCommands)) {
            const updatedTest = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
                {body: testCommands},
            );
            console.log('Updated test (guild) commands.', updatedTest);
        } else {
            console.log('Test (guild) commands are up to date.');
        }
    }
}