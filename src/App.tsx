import React, { useEffect, useRef, useState } from 'react';
import { IfcParser } from '@ifc-lite/parser';
import { GeometryProcessor } from '@ifc-lite/geometry';
import { Renderer } from '@ifc-lite/renderer';
import { setupCameraControls } from './controls';

type GristRecord = Record<string, unknown>;

interface GristApi {
	ready(options: {
		requiredAccess: string;
		columns: Array<{
			name: string;
			title: string;
			type: string;
			optional: boolean;
		}>;
	}): void;
	onRecord(callback: (record: GristRecord) => void): void;
	mapColumnNames(record: GristRecord): Record<string, string | undefined>;
}

declare global {
	interface Window {
		grist?: GristApi;
	}
}

const TEST_IFC_FILES = [
	{
		name: 'AC20-FZK-Haus.ifc',
		url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/AC20-FZK-Haus.ifc',
	},
	{
		name: 'Duplex model',
		url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/duplex.ifc',
	},
	{
		name: 'Sample entities',
		url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/Sample_entities.ifc',
	},
];

export default function App() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<Renderer | null>(null);
	const [renderer, setRenderer] = useState<Renderer | null>(null);
	const [status, setStatus] = useState('Waiting for Grist selection...');
	const currentUrlRef = useRef<string | null>(null);
	const loadRequestRef = useRef(0);
	const [selectedTestFile, setSelectedTestFile] = useState(TEST_IFC_FILES[0].url);

	// Initialize WebGPU Renderer
	useEffect(() => {
		async function init() {
			if (canvasRef.current && !rendererRef.current) {
				try {
					const renderer = new Renderer(canvasRef.current);
					await renderer.init();
					rendererRef.current = renderer;
					setRenderer(renderer);
					setStatus('Ready. Select a row in Grist containing an IFC URL.');
				} catch (err) {
					setStatus('WebGPU Initialization Failed. Ensure browser supports WebGPU.');
				}
			}
		}

		init();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas || !renderer) return;

		return setupCameraControls(canvas, renderer);
	}, [renderer]);

	// Keep the renderer viewport in sync with the responsive canvas.
	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas) return;

		const resize = () => {
			const renderer = rendererRef.current;

			if (!renderer) return;

			const pixelRatio = window.devicePixelRatio || 1;
			const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
			const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

			renderer.resize(width, height);
			renderer.fitToView();
			renderer.render();
		};

		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();

		return () => observer.disconnect();
	}, []);

	// Configure Grist Listener
	useEffect(() => {
		const grist = window.grist;

		if (grist) {
			grist.ready({
				requiredAccess: 'read table',
				columns: [
					{
						name: 'IFC_URL',
						title: 'IFC File URL',
						type: 'Text',
						optional: false,
					},
				],
			});

			grist.onRecord((record) => {
				const mapped = grist.mapColumnNames(record);
				const url = mapped.IFC_URL;

				if (typeof url === 'string' && url.trim()) {
					if (url !== currentUrlRef.current) {
						currentUrlRef.current = url;
						loadIfc(url);
					}
				} else {
					setStatus('Please map the "IFC File URL" column in Grist Widget options.');
				}
			});
		}
	}, []);

	// Load IFC Buffer &amp; Render Geometry
	async function loadIfc(url: string) {
		const canvas = canvasRef.current;
		const requestId = ++loadRequestRef.current;

		if (!canvas) return;

		const previousRenderer = rendererRef.current;
		rendererRef.current = null;
		setRenderer(null);
		previousRenderer?.destroy();

		setStatus('Fetching IFC file...');

		try {
			const nextRenderer = new Renderer(canvas);
			await nextRenderer.init();

			if (requestId !== loadRequestRef.current) {
				nextRenderer.destroy();
				return;
			}

			rendererRef.current = nextRenderer;
			setRenderer(nextRenderer);

			const response = await fetch(url);

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const buffer = await response.arrayBuffer();
			setStatus('Parsing IFC Geometry...');

			const geometry = new GeometryProcessor();
			await geometry.init();

			const parser = new IfcParser();
			const store = await parser.parseColumnar(buffer);
			const meshes = [];

			for await (const event of geometry.processAdaptive(new Uint8Array(buffer))) {
				if (event.type === 'batch') meshes.push(...event.meshes);
			}

			if (requestId !== loadRequestRef.current) {
				nextRenderer.destroy();
				return;
			}

			nextRenderer.loadGeometry(meshes);
			const pixelRatio = window.devicePixelRatio || 1;
			nextRenderer.resize(
				Math.max(1, Math.floor(canvas.clientWidth * pixelRatio)),
				Math.max(1, Math.floor(canvas.clientHeight * pixelRatio)),
			);
			nextRenderer.fitToView();
			nextRenderer.render();
			setStatus(`Loaded model (${store.entityCount} entities)`);
		} catch (err) {
			if (requestId === loadRequestRef.current && rendererRef.current) {
				rendererRef.current.destroy();
				rendererRef.current = null;
				setRenderer(null);
			}
				setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
			console.error(err);
		}
	}

	return (
		<div className="app">
			<aside className="sidebar">
				<label className="label">
				Test IFC model
				<select
					value={selectedTestFile}
					onChange={(event) => setSelectedTestFile(event.target.value)}
				>
					{TEST_IFC_FILES.map((file) => (
						<option key={file.url} value={file.url}>
							{file.name}
						</option>
					))}
				</select>
			</label>
				<button
					className="uploadButton"
					type="button"
					onClick={() => {
						currentUrlRef.current = selectedTestFile;
						loadIfc(selectedTestFile);
					}}
				>
					Load test model
				</button>
				<p className="muted">{status}</p>
			</aside>
			<main className="viewportShell">
				<canvas className="viewport" ref={canvasRef}></canvas>
			</main>
		</div>
	);
}