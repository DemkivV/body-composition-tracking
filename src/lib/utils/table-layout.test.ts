import { describe, it, expect, beforeEach } from 'vitest';
import {
	calculateTableColumnWidths,
	calculateOptimalColumnWidth,
	type ColumnWidthResult
} from './table-layout';

type TestRowType = {
	id: string;
	Date: string;
	'Weight (kg)': string;
	'Body Fat (%)': string;
	Comments: string;
};

const mockHeaders = [
	{ key: 'Date' as keyof TestRowType, label: 'Date', type: 'date' },
	{ key: 'Weight (kg)' as keyof TestRowType, label: 'Weight (kg)', type: 'number' },
	{ key: 'Body Fat (%)' as keyof TestRowType, label: 'Body Fat (%)', type: 'number' },
	{ key: 'Comments' as keyof TestRowType, label: 'Comments', type: 'text' }
];

const mockData: TestRowType[] = [
	{
		id: '1',
		Date: '2023-01-01',
		'Weight (kg)': '70.5',
		'Body Fat (%)': '15.2',
		Comments: 'Feeling good today'
	},
	{
		id: '2',
		Date: '2023-01-02',
		'Weight (kg)': '70.2',
		'Body Fat (%)': '15.0',
		Comments: 'Slight improvement'
	}
];

describe('Table Layout Utilities', () => {
	describe('calculateOptimalColumnWidth', () => {
		it('should calculate appropriate width for date columns', () => {
			const result = calculateOptimalColumnWidth(mockHeaders[0], mockData);
			
			expect(result.width).toMatch(/^\d+px$/);
			expect(parseInt(result.width)).toBeGreaterThanOrEqual(110); // Date minimum
			expect(result.reasoning).toContain('Date column');
		});

		it('should calculate appropriate width for number columns', () => {
			const weightHeader = mockHeaders[1];
			const result = calculateOptimalColumnWidth(weightHeader, mockData);
			
			expect(result.width).toMatch(/^\d+px$/);
			expect(parseInt(result.width)).toBeLessThanOrEqual(90); // Number columns should be compact
			expect(result.reasoning).toContain('Number column');
		});

		it('should handle comment columns as flexible', () => {
			const result = calculateOptimalColumnWidth(mockHeaders[3], mockData);
			
			expect(result.width).toMatch(/^\d+px$/);
			expect(result.reasoning).toContain('Comment');
		});

		it('should handle empty data gracefully', () => {
			const result = calculateOptimalColumnWidth(mockHeaders[0], []);
			
			expect(result.width).toMatch(/^\d+px$/);
			expect(parseInt(result.width)).toBeGreaterThan(0);
		});
	});

	describe('calculateTableColumnWidths', () => {
		it('should return individual widths for each column', () => {
			const results = calculateTableColumnWidths(mockHeaders, mockData, 800);
			
			expect(results.size).toBe(4);
			expect(results.has('Date')).toBe(true);
			expect(results.has('Weight (kg)')).toBe(true);
			expect(results.has('Body Fat (%)')).toBe(true);
			expect(results.has('Comments')).toBe(true);
			
			// Verify each column has different widths (not all the same)
			const widths = Array.from(results.values()).map(r => parseInt(r.width));
			const uniqueWidths = new Set(widths);
			expect(uniqueWidths.size).toBeGreaterThan(1); // Should have different widths
		});

		it('should not exceed available table width', () => {
			const tableWidth = 600;
			const results = calculateTableColumnWidths(mockHeaders, mockData, tableWidth);
			
			const totalWidth = Array.from(results.values())
				.reduce((sum, result) => sum + parseInt(result.width), 50); // 50 for actions
			
			expect(totalWidth).toBeLessThanOrEqual(tableWidth + 20); // Allow small margin
		});

		it('should scale down columns when space is limited', () => {
			const smallTableWidth = 300;
			const results = calculateTableColumnWidths(mockHeaders, mockData, smallTableWidth);
			
			// All columns should be scaled down and fit within available space
			const totalWidth = Array.from(results.values())
				.reduce((sum, result) => sum + parseInt(result.width), 50); // 50 for actions
			
			expect(totalWidth).toBeLessThanOrEqual(smallTableWidth + 20); // Allow some margin
			
			// Individual columns should be reasonably sized
			Array.from(results.values()).forEach(result => {
				expect(parseInt(result.width)).toBeGreaterThan(20); // Some reasonable minimum
				expect(parseInt(result.width)).toBeLessThanOrEqual(100); // Should be compact
			});
		});

		it('should handle comments column as flexible', () => {
			const results = calculateTableColumnWidths(mockHeaders, mockData, 1000);
			const commentsResult = results.get('Comments');
			
			expect(commentsResult).toBeDefined();
			expect(commentsResult!.reasoning).toContain('Comment');
		});

		it('should calculate appropriate title lines', () => {
			const results = calculateTableColumnWidths(mockHeaders, mockData, 800);
			
			// Weight (kg) should have multiple lines due to parentheses
			const weightResult = results.get('Weight (kg)');
			expect(weightResult).toBeDefined();
			expect(weightResult!.titleLines).toBeGreaterThanOrEqual(1);
		});

		it('should handle edge case of very narrow table', () => {
			const veryNarrowWidth = 200;
			const results = calculateTableColumnWidths(mockHeaders, mockData, veryNarrowWidth);
			
			expect(results.size).toBe(4);
			
			// Should apply emergency scaling
			const totalWidth = Array.from(results.values())
				.reduce((sum, result) => sum + parseInt(result.width), 50);
			
			expect(totalWidth).toBeLessThanOrEqual(veryNarrowWidth + 10);
		});

		it('should handle datetime-local columns appropriately', () => {
			const datetimeHeaders = [
				{ key: 'DateTime' as keyof TestRowType, label: 'Date Time', type: 'datetime-local' }
			];
			
			const results = calculateTableColumnWidths(datetimeHeaders, mockData, 800);
			const datetimeResult = results.get('DateTime');
			
			expect(datetimeResult).toBeDefined();
			expect(parseInt(datetimeResult!.width)).toBeGreaterThanOrEqual(140); // Datetime minimum
			expect(datetimeResult!.reasoning).toContain('Datetime column');
		});

		it('should preserve relative sizing between different column types', () => {
			const results = calculateTableColumnWidths(mockHeaders, mockData, 1000);
			
			const dateWidth = parseInt(results.get('Date')!.width);
			const weightWidth = parseInt(results.get('Weight (kg)')!.width);
			const commentsWidth = parseInt(results.get('Comments')!.width);
			
			// Date should be wider than weight (due to minimum requirements)
			expect(dateWidth).toBeGreaterThan(weightWidth);
			
			// Comments should be flexible and potentially wider
			expect(commentsWidth).toBeGreaterThanOrEqual(weightWidth);
		});

		it('should handle empty headers array', () => {
			const results = calculateTableColumnWidths([], mockData, 800);
			expect(results.size).toBe(0);
		});

		it('should provide meaningful reasoning for width decisions', () => {
			const results = calculateTableColumnWidths(mockHeaders, mockData, 800);
			
			Array.from(results.values()).forEach(result => {
				expect(result.reasoning).toBeTruthy();
				expect(typeof result.reasoning).toBe('string');
				expect(result.reasoning.length).toBeGreaterThan(10);
			});
		});

		it('should ensure minimum widths are respected in reasonable scenarios', () => {
			const reasonableTable = 500; // Large enough that 40px minimums should be possible
			const results = calculateTableColumnWidths(mockHeaders, mockData, reasonableTable);
			
			Array.from(results.values()).forEach(result => {
				expect(parseInt(result.width)).toBeGreaterThanOrEqual(40); // Minimum for reasonable table
			});
		});

		it('should distribute space efficiently for medium-sized tables', () => {
			const mediumTableWidth = 800;
			const results = calculateTableColumnWidths(mockHeaders, mockData, mediumTableWidth);
			
			const totalUsed = Array.from(results.values())
				.reduce((sum, result) => sum + parseInt(result.width), 50);
			
			// Should use most of the available space efficiently
			expect(totalUsed).toBeGreaterThan(mediumTableWidth * 0.7); // At least 70% utilization
			expect(totalUsed).toBeLessThanOrEqual(mediumTableWidth);
		});
	});

	describe('Column width edge cases', () => {
		it('should handle very long header text', () => {
			const longHeaderData = [
				{
					key: 'VeryLongColumnName' as keyof TestRowType,
					label: 'This Is A Very Long Column Header That Should Wrap',
					type: 'text'
				}
			];
			
			const results = calculateTableColumnWidths(longHeaderData, mockData, 800);
			const result = results.get('VeryLongColumnName');
			
			expect(result).toBeDefined();
			expect(result!.titleLines).toBeGreaterThan(1);
			expect(parseInt(result!.width)).toBeGreaterThan(50);
		});

		it('should handle single character headers', () => {
			const shortHeaderData = [
				{ key: 'id' as keyof TestRowType, label: 'ID', type: 'text' }
			];
			
			const results = calculateTableColumnWidths(shortHeaderData, mockData, 800);
			const result = results.get('id');
			
			expect(result).toBeDefined();
			expect(parseInt(result!.width)).toBeGreaterThanOrEqual(40);
		});
	});
});
