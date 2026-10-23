import { withBase } from '../config/paths';
import { DRILL_LABELS } from '../lib/typing/drills';
import type { DrillKind } from '../lib/typing/drills';
import { drillForKey, mergeTallies, summariseKeys, weakestFinger, weakestKeys } from '../lib/typing/keys';
import type { KeySummary } from '../lib/typing/keys';
import { clearHistory, readHistory } from '../lib/storage';
import type { HistoryEntry } from '../lib/storage';

/**
 * Fills in the per-key analysis from the results stored on this device.
 *
 * The page ships a complete, readable keyboard and a full explanation without
 * this file. All this script does is paint the numbers on top: the accuracy of
 * every key, the keys worth practising and the recent tests they came from.
 */

const ROOT_SELECTOR = '[data-analysis]';

/** How many tests the recent results table shows. */
const RECENT_TESTS = 10;

/**
 * A percentage with at most one decimal place.
 *
 * `100%` and `92.4%` both read naturally; `100.0%` does not.
 */
function formatPercent(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** "1 press" / "12 presses". */
function countLabel(count: number, singular: string, plural: string): string {
	return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/** The display name of a stored drill, tolerating values we no longer know. */
function drillName(drill: string): string {
	return drill in DRILL_LABELS ? DRILL_LABELS[drill as DrillKind] : drill;
}

/** A stored timestamp, in the visitor's own locale. */
function formatWhen(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '—';

	const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	return `${day}, ${time}`;
}

/** One plain table cell. */
function tableCell(text: string, className?: string): HTMLTableCellElement {
	const cell = document.createElement('td');
	if (className) cell.className = className;
	cell.textContent = text;
	return cell;
}

/** Paint the accuracy of every key onto the board. */
function renderHeatmap(summaries: readonly KeySummary[]): void {
	const byKey = new Map(summaries.map((summary) => [summary.key, summary]));

	for (const cell of document.querySelectorAll<HTMLElement>('.kb-key')) {
		const summary = byKey.get(cell.dataset.key ?? '');
		const value = cell.querySelector<HTMLElement>('[data-key-value]');
		const detail = cell.querySelector<HTMLElement>('[data-key-detail]');

		if (!summary || !summary.used) {
			cell.dataset.band = 'unused';
			if (value) value.textContent = '—';
			if (detail) detail.textContent = '';
			continue;
		}

		cell.dataset.band = summary.band;
		if (value) value.textContent = `${Math.round(summary.accuracy)}%`;
		if (detail) {
			const presses = countLabel(summary.pressed, 'press', 'presses');
			const missed = summary.missed > 0 ? `, ${summary.missed} missed` : '';
			detail.textContent = `${presses}${missed}`;
		}
	}
}

/** Fill the "keys to practise" table. */
function renderWeakestKeys(tbody: HTMLTableSectionElement, summaries: readonly KeySummary[]): void {
	tbody.replaceChildren();

	for (const summary of weakestKeys(summaries)) {
		const row = document.createElement('tr');

		const keyCell = document.createElement('td');
		const chip = document.createElement('span');
		chip.className = 'ka-key';
		chip.dataset.band = summary.band;
		chip.textContent = summary.label;
		keyCell.append(chip);

		const drill = drillForKey(summary.key);
		const drillCell = document.createElement('td');
		const link = document.createElement('a');
		link.href = withBase(drill.href);
		link.className = 'ka-link';
		link.textContent = drill.label;
		drillCell.append(link);

		row.append(
			keyCell,
			tableCell(summary.fingerLabel),
			tableCell(formatPercent(summary.accuracy), 'ka-num'),
			tableCell(String(summary.pressed), 'ka-num ka-hide-sm'),
			tableCell(String(summary.missed), 'ka-num'),
			drillCell,
		);
		tbody.append(row);
	}
}

/** Fill the recent results table, newest first. */
function renderHistory(tbody: HTMLTableSectionElement, entries: readonly HistoryEntry[]): void {
	tbody.replaceChildren();

	for (const entry of entries.slice(0, RECENT_TESTS)) {
		const row = document.createElement('tr');
		row.append(
			tableCell(formatWhen(entry.at)),
			tableCell(`${entry.durationSeconds}s ${drillName(entry.drill)}`),
			tableCell(String(Math.round(entry.netWpm)), 'ka-num'),
			tableCell(formatPercent(entry.charAccuracy), 'ka-num'),
		);
		tbody.append(row);
	}
}

/** Draw everything that depends on stored results. */
function render(): void {
	const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
	if (!root) return;

	const empty = root.querySelector<HTMLElement>('[data-analysis-empty]');
	const content = root.querySelector<HTMLElement>('[data-analysis-content]');
	const summaryLine = root.querySelector<HTMLElement>('[data-analysis-summary]');
	const fingerLine = root.querySelector<HTMLElement>('[data-analysis-finger]');
	const weakestBody = root.querySelector<HTMLTableSectionElement>('[data-analysis-weakest]');
	const historyBody = root.querySelector<HTMLTableSectionElement>('[data-analysis-history]');
	if (!content || !summaryLine || !weakestBody || !historyBody) return;

	const history = readHistory();
	const summaries = summariseKeys(mergeTallies(history.map((entry) => entry.tallies)));

	// The board is painted either way, so the page never shows a stale map.
	renderHeatmap(summaries);

	if (history.length === 0) {
		if (empty) empty.hidden = false;
		summaryLine.hidden = true;
		if (fingerLine) fingerLine.hidden = true;
		content.hidden = true;
		return;
	}

	if (empty) empty.hidden = true;
	content.hidden = false;
	summaryLine.hidden = false;

	const presses = summaries.reduce((total, summary) => total + summary.pressed, 0);
	const usedKeys = summaries.filter((summary) => summary.used).length;

	summaryLine.textContent =
		`Built from your last ${countLabel(history.length, 'test', 'tests')} on this device: ` +
		`${presses.toLocaleString()} keystrokes across ${countLabel(usedKeys, 'key', 'keys')}.`;

	if (fingerLine) {
		const finger = weakestFinger(summaries);
		const worthNaming =
			finger !== null && finger.pressed + finger.missed >= 10 && finger.accuracy < 100;

		fingerLine.hidden = !worthNaming;
		if (worthNaming) {
			fingerLine.textContent = `The least accurate finger is your ${finger.label}, at ${formatPercent(finger.accuracy)}.`;
		}
	}

	renderWeakestKeys(weakestBody, summaries);
	renderHistory(historyBody, history);
}

function init(): void {
	const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
	if (!root) return;

	const clear = root.querySelector<HTMLButtonElement>('[data-analysis-clear]');
	const status = root.querySelector<HTMLElement>('[data-analysis-status]');

	clear?.addEventListener('click', () => {
		clearHistory();
		render();
		if (status) status.textContent = 'Saved results cleared from this browser.';
	});

	render();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}
