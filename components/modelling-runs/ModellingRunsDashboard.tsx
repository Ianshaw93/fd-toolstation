'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CLOUDHPC_ENABLED,
  ENGINEER_STORAGE_KEY,
  formatProgress,
  formatTimestamp,
  parseMachines,
  parseRuns,
  postJson,
  runsListPath,
  runViewHref,
} from '../../lib/modelling-runs/client';
import type { Machine, ModellingRun } from '../../lib/modelling-runs/types';
import { usePolledJson } from './usePolledJson';

const STATUSES = ['queued', 'running', 'stopped', 'failed', 'completed'] as const;

function FieldLabel({ id, children }: { id: string; children: string }) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
      {children}
    </label>
  );
}

export default function ModellingRunsDashboard() {
  const [target, setTarget] = useState('');
  const [machineId, setMachineId] = useState('');
  const [status, setStatus] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [engineer, setEngineer] = useState('');
  const [caseName, setCaseName] = useState('');
  const [inputFile, setInputFile] = useState('');
  const [startMachine, setStartMachine] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(ENGINEER_STORAGE_KEY);
    if (saved) setEngineer(saved);
  }, []);

  function rememberEngineer(value: string) {
    setEngineer(value);
    localStorage.setItem(ENGINEER_STORAGE_KEY, value);
  }

  const runsUrl = runsListPath({
    target,
    machine_id: machineId,
    status,
    q: query,
    user: query.trim() ? engineer : undefined,
  });
  const machinesPoll = usePolledJson('/api/cfd-dashboard/machines', parseMachines);
  const runsPoll = usePolledJson(runsUrl, parseRuns);
  const machines = machinesPoll.data ?? [];
  const runs = runsPoll.data ?? [];
  const startable = machines.filter((machine) => machine.target_type === 'local' || CLOUDHPC_ENABLED);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(draftQuery.trim());
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!engineer.trim()) {
      setFormError('Enter your name so the run is logged.');
      return;
    }
    if (!startMachine) {
      setFormError('Choose a machine.');
      return;
    }
    if (!caseName.trim()) {
      setFormError('Case name is required.');
      return;
    }
    if (!inputFile.trim()) {
      setFormError('Input file is required.');
      return;
    }
    setStarting(true);
    try {
      await postJson('/api/cfd-dashboard/runs', {
        machine_id: startMachine,
        case_name: caseName.trim(),
        input_file_ref: inputFile.trim(),
        created_by: engineer.trim(),
      });
      setCaseName('');
      setInputFile('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start the run');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-label="Machine status">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Machines</h2>
        {machinesPoll.error ? (
          <p role="alert" className="text-sm text-red-700">
            {machinesPoll.error}
          </p>
        ) : null}
        {machines.length > 0 ? (
          <ul aria-label="Machines" className="flex flex-wrap gap-3">
            {machines.map((machine) => (
              <MachineChip key={machine.id} machine={machine} />
            ))}
          </ul>
        ) : machinesPoll.loading ? (
          <p className="text-sm text-gray-400">Loading machines…</p>
        ) : (
          <p className="text-sm text-gray-400">No machines have reported in.</p>
        )}
      </section>

      <section aria-label="Start a run" className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Start a run</h2>
        <form onSubmit={onStart} className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel id="run-engineer">Engineer</FieldLabel>
            <input
              id="run-engineer"
              value={engineer}
              onChange={(event) => rememberEngineer(event.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel id="run-start-machine">Start on</FieldLabel>
            <select
              id="run-start-machine"
              value={startMachine}
              onChange={(event) => setStartMachine(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Select a machine</option>
              {startable.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel id="run-case-name">Case name</FieldLabel>
            <input
              id="run-case-name"
              value={caseName}
              onChange={(event) => setCaseName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel id="run-input-file">Input file</FieldLabel>
            <input
              id="run-input-file"
              value={inputFile}
              onChange={(event) => setInputFile(event.target.value)}
              placeholder="cases/corridor.fds"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={starting}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {starting ? 'Starting…' : 'Start run'}
            </button>
            {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          </div>
        </form>
      </section>

      <section aria-label="Runs">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Runs</h2>
        <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <FieldLabel id="run-target">Target</FieldLabel>
            <select
              id="run-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">All</option>
              <option value="local">local</option>
              <option value="cloudhpc">cloudhpc</option>
            </select>
          </div>
          <div>
            <FieldLabel id="run-machine">Machine</FieldLabel>
            <select
              id="run-machine"
              value={machineId}
              onChange={(event) => setMachineId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">All</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel id="run-status">Status</FieldLabel>
            <select
              id="run-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">All</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[12rem]">
            <FieldLabel id="run-search">Search runs</FieldLabel>
            <input
              id="run-search"
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Search
          </button>
        </form>

        {runsPoll.error ? (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {runsPoll.error}
          </p>
        ) : null}
        {runsPoll.loading && runs.length === 0 ? <p className="text-sm text-gray-400">Loading runs…</p> : null}
        {!runsPoll.loading && runs.length === 0 ? (
          <p className="text-sm text-gray-400">No runs match these filters.</p>
        ) : null}
        {runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table aria-label="Runs" className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-4 font-medium">Case</th>
                  <th className="pb-2 pr-4 font-medium">Target</th>
                  <th className="pb-2 pr-4 font-medium">Machine</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Progress</th>
                  <th className="pb-2 font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} href={runViewHref(run.id, query, engineer)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MachineChip({ machine }: { machine: Machine }) {
  const dot =
    machine.status === 'online' ? 'bg-green-500' : machine.status === 'idle' ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <li className="min-w-[12rem] rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-medium text-gray-900">{machine.name}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {machine.status}
        <span className="text-gray-400"> · {machine.target_type}</span>
      </p>
      {machine.last_heartbeat_at ? (
        <time dateTime={machine.last_heartbeat_at} className="mt-1 block text-xs text-gray-400">
          {formatTimestamp(machine.last_heartbeat_at)}
        </time>
      ) : (
        <span className="mt-1 block text-xs text-gray-400">No heartbeat</span>
      )}
    </li>
  );
}

function RunRow({ run, href }: { run: ModellingRun; href: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-gray-900">{run.case_name}</td>
      <td className="py-2 pr-4 text-gray-600">{run.target}</td>
      <td className="py-2 pr-4 font-mono text-xs text-gray-500">{run.machine_name || '—'}</td>
      <td className="py-2 pr-4 text-gray-900">{run.status}</td>
      <td className="py-2 pr-4 text-gray-600">{formatProgress(run.progress_pct)}</td>
      <td className="py-2">
        <Link href={href} aria-label={`View ${run.case_name}`} className="text-blue-700 hover:underline">
          View
        </Link>
      </td>
    </tr>
  );
}
