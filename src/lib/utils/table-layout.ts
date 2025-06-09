/**
 * Utility functions for dynamic table column width calculation
 * This module provides generic, reusable column sizing logic based on content analysis
 */

interface ColumnConfig<T> {
	key: keyof T;
	label: string;
	type: string;
}

export interface ColumnWidthResult {
	width: string;
	titleLines: number;
	reasoning: string;
}

/**
 * Get text width using simple character estimation (more reliable than canvas in all environments)
 */
function estimateTextWidth(text: string, charWidth: number = 8): number {
	return text.length * charWidth;
}

/**
 * Determine appropriate width for each column type
 */
function getColumnBaseWidth<T>(
	header: ColumnConfig<T>,
	data: T[]
): { width: number; isFlexible: boolean; reasoning: string } {
	const headerText = header.label;
	const headerWords = headerText.split(/\s+/);
	const longestWord = Math.max(...headerWords.map(word => estimateTextWidth(word)));
	const minHeaderWidth = longestWord + 24; // padding for header

	// Sample content to understand typical data length
	const sampleSize = Math.min(data.length, 20);
	const contentSamples = data.slice(0, sampleSize).map(row => String(row[header.key] || ''));
	const maxContentLength = Math.max(...contentSamples.map(content => estimateTextWidth(content)));
	const avgContentLength = contentSamples.length > 0 
		? contentSamples.reduce((sum, content) => sum + estimateTextWidth(content), 0) / contentSamples.length 
		: 80;

	// Column type-specific width determination
	if (header.type === 'datetime-local') {
		// Datetime needs space for full timestamp + calendar icon
		return {
			width: Math.max(minHeaderWidth, 140),
			isFlexible: false,
			reasoning: `Datetime column - fixed width for datetime input (140px)`
		};
	}

	if (header.type === 'date') {
		// Date needs space for date + calendar icon
		return {
			width: Math.max(minHeaderWidth, 110),
			isFlexible: false,
			reasoning: `Date column - fixed width for date input (110px)`
		};
	}

	if (header.type === 'number') {
		// Numbers are typically shorter, but account for larger values
		const numberWidth = Math.max(minHeaderWidth, Math.min(maxContentLength + 20, 90));
		return {
			width: numberWidth,
			isFlexible: false,
			reasoning: `Number column - content-based width (${numberWidth}px)`
		};
	}

	// Text columns - check if it's a comment/notes field (should be flexible)
	const isCommentField = headerText.toLowerCase().includes('comment') ||
		headerText.toLowerCase().includes('note') ||
		String(header.key).toLowerCase().includes('comment');

	if (isCommentField) {
		return {
			width: Math.max(minHeaderWidth, 120),
			isFlexible: true,
			reasoning: `Comment/text column - flexible width`
		};
	}

	// Regular text column - balance between header and content
	const textWidth = Math.max(minHeaderWidth, Math.min(avgContentLength + 16, 120));
	return {
		width: textWidth,
		isFlexible: false,
		reasoning: `Text column - balanced width (${textWidth}px)`
	};
}

/**
 * Calculate how many lines the header should wrap to
 */
function calculateHeaderLines(headerText: string, availableWidth: number): number {
	const words = headerText.split(/\s+/);
	if (words.length <= 1) return 1;

	// Try to fit words efficiently
	let lines = 1;
	let currentLineWidth = 0;
	const spaceWidth = 8; // estimated space width

	for (const word of words) {
		const wordWidth = estimateTextWidth(word);
		
		if (currentLineWidth === 0) {
			// First word on line
			currentLineWidth = wordWidth;
		} else if (currentLineWidth + spaceWidth + wordWidth <= availableWidth - 20) {
			// Can fit on current line
			currentLineWidth += spaceWidth + wordWidth;
		} else {
			// Need new line
			lines++;
			currentLineWidth = wordWidth;
		}
	}

	return Math.min(lines, 3); // Max 3 lines for readability
}

/**
 * Main function to calculate column widths for the entire table
 */
export function calculateTableColumnWidths<T>(
	headers: ColumnConfig<T>[],
	data: T[],
	tableWidth: number = 1200
): Map<keyof T, ColumnWidthResult> {
	const results = new Map<keyof T, ColumnWidthResult>();

	if (headers.length === 0) return results;

	// Reserve space for actions column
	const actionsWidth = 50;
	const availableWidth = tableWidth - actionsWidth - 20; // 20px margin

	// Calculate base widths for all columns
	const columnSpecs = headers.map(header => ({
		header,
		...getColumnBaseWidth(header, data)
	}));

	// Separate fixed and flexible columns
	const fixedColumns = columnSpecs.filter(spec => !spec.isFlexible);
	const flexColumns = columnSpecs.filter(spec => spec.isFlexible);

	// Calculate total width needed by fixed columns
	const fixedTotalWidth = fixedColumns.reduce((sum, spec) => sum + spec.width, 0);

	// Calculate scaling if needed
	let scale = 1;
	let remainingWidth = availableWidth - fixedTotalWidth;

	if (fixedTotalWidth > availableWidth) {
		// Fixed columns alone exceed available space - need to scale everything down
		scale = availableWidth / (fixedTotalWidth + flexColumns.length * 100); // assume 100px per flex column minimum
		remainingWidth = 0;
	}

	// Apply results for fixed columns
	fixedColumns.forEach(({ header, width, reasoning }) => {
		const finalWidth = Math.max(40, Math.round(width * scale)); // Enforce 40px minimum
		const titleLines = calculateHeaderLines(header.label, finalWidth);
		
		results.set(header.key, {
			width: `${finalWidth}px`,
			titleLines,
			reasoning: scale < 1 ? `${reasoning} (scaled by ${(scale * 100).toFixed(0)}%)` : reasoning
		});
	});

	// Apply results for flexible columns
	flexColumns.forEach(({ header, width, reasoning }) => {
		let finalWidth: number;
		
		if (flexColumns.length > 0 && remainingWidth > 0) {
			// Distribute remaining width among flexible columns
			const flexWidth = Math.max(width * scale, remainingWidth / flexColumns.length);
			finalWidth = Math.max(40, Math.round(flexWidth)); // Enforce minimum
		} else {
			// No remaining space, use minimum width
			finalWidth = Math.max(40, Math.round(width * scale)); // Enforce minimum
		}

		const titleLines = calculateHeaderLines(header.label, finalWidth);
		
		results.set(header.key, {
			width: `${finalWidth}px`,
			titleLines,
			reasoning: `${reasoning} - allocated ${finalWidth}px`
		});
	});

	// Final verification - ensure we don't exceed table width
	const totalCalculatedWidth = Array.from(results.values())
		.reduce((sum, result) => sum + parseInt(result.width), actionsWidth);

	if (totalCalculatedWidth > tableWidth) {
		// Emergency proportional scaling - but ensure minimum widths
		const availableForColumns = tableWidth - actionsWidth - 10;
		const minimumTotal = headers.length * 40; // 40px minimum per column
		
		if (availableForColumns < minimumTotal) {
			// Even minimums don't fit - use absolute minimums
			results.forEach((result, key) => {
				const header = headers.find(h => h.key === key);
				if (header) {
					const titleLines = calculateHeaderLines(header.label, 40);
					results.set(key, {
						width: `40px`,
						titleLines,
						reasoning: `${result.reasoning} (absolute minimum 40px)`
					});
				}
			});
		} else {
			// Scale proportionally but enforce minimums
			const emergencyScale = availableForColumns / (totalCalculatedWidth - actionsWidth);
			
			results.forEach((result, key) => {
				const currentWidth = parseInt(result.width);
				const scaledWidth = Math.max(40, Math.round(currentWidth * emergencyScale));
				const header = headers.find(h => h.key === key);
				
				if (header) {
					const titleLines = calculateHeaderLines(header.label, scaledWidth);
					results.set(key, {
						width: `${scaledWidth}px`,
						titleLines,
						reasoning: `${result.reasoning} (emergency scaled to ${scaledWidth}px)`
					});
				}
			});
		}
	}

	return results;
}

// Keep existing functions for compatibility
export function calculateOptimalColumnWidth<T>(
	header: ColumnConfig<T>,
	data: T[],
	tableWidth: number = 1200,
	totalColumns: number = 1,
	isFlexColumn: boolean = false
): ColumnWidthResult {
	const spec = getColumnBaseWidth(header, data);
	const titleLines = calculateHeaderLines(header.label, spec.width);
	
	return {
		width: `${spec.width}px`,
		titleLines,
		reasoning: spec.reasoning
	};
}

export function applyTableColumnWidths<T>(
	tableElement: HTMLElement,
	columnWidths: Map<keyof T, ColumnWidthResult>
): void {
	// Apply widths directly - no CSS custom properties needed
	columnWidths.forEach((result, key) => {
		const cssVarName = `--col-width-${String(key).replace(/[^a-zA-Z0-9]/g, '-')}`;
		tableElement.style.setProperty(cssVarName, result.width);
	});
}

export function logColumnWidthDecisions<T>(columnWidths: Map<keyof T, ColumnWidthResult>): void {
	// Only log in development with explicit debug flag
	if (typeof window !== 'undefined' && window.location?.search?.includes('debug=true')) {
		console.group('🎯 Column Width Decisions');
		columnWidths.forEach((result, key) => {
			console.log(
				`${String(key)}: ${result.width} (${result.titleLines} lines) - ${result.reasoning}`
			);
		});
		console.groupEnd();
	}
}

// Debug function to test width calculations
export function debugTableWidths(): void {
	const testHeaders = [
		{ key: 'Date', label: 'Date', type: 'date' },
		{ key: 'Weight (kg)', label: 'Weight (kg)', type: 'number' },
		{ key: 'Body Fat (%)', label: 'Body Fat (%)', type: 'number' },
		{ key: 'Comments', label: 'Comments', type: 'text' }
	];
	
	const testData = [
		{ Date: '2023-01-01', 'Weight (kg)': '70.5', 'Body Fat (%)': '15.2', Comments: 'Feeling good' },
		{ Date: '2023-01-02', 'Weight (kg)': '70.2', 'Body Fat (%)': '15.0', Comments: 'Slight improvement' }
	];
	
	console.group('🔍 Debug Table Width Calculation');
	const results = calculateTableColumnWidths(testHeaders, testData, 800);
	
	console.log('Table width: 800px');
	let totalWidth = 50; // actions column
	
	results.forEach((result, key) => {
		const width = parseInt(result.width);
		totalWidth += width;
		console.log(`${String(key)}: ${result.width} (${result.titleLines} lines) - ${result.reasoning}`);
	});
	
	console.log(`Total width: ${totalWidth}px (should be ≤ 800px)`);
	console.groupEnd();
}
