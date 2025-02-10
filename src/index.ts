import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import GUI from 'lil-gui';

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let orbitControls: OrbitControls;
let gui: GUI;

// Data set and 3D blocks
let dataset: number[] = [];
let blocks: THREE.Mesh[] = [];

// Sorting states
let isSorting = false;
let interruptRequested = false;
let arrayAccessCount = 0;
let comparisonCount = 0;
let startTimestamp = 0;
let finishTimestamp: number | null = null;

// Audio
const audioCtx = new (window.AudioContext ||
  (window as any).webkitAudioContext)();

// Materials map and currently used material
const materials: Record<string, THREE.ShaderMaterial> = {};
let activeMaterial: THREE.ShaderMaterial;

// Timing delay (controls sort speed)
let interval = 0;

// Time-space complexity info
const complexityMap: Record<string, { average: string; space: string }> = {
  'Selection Sort': { average: 'O(n²)', space: 'O(1)' },
  'Insertion Sort': { average: 'O(n²)', space: 'O(1)' },
  'Quick Sort': { average: 'O(n log n)', space: 'O(n)' },
  'Merge Sort': { average: 'O(n log n)', space: 'O(n)' },
  'Heap Sort': { average: 'O(n log n)', space: 'O(1)' },
  'Radix Sort': { average: 'O(nk)', space: 'O(n+k)' },
  'Shell Sort': { average: 'O(n log n)', space: 'O(1)' },
  'Bubble Sort': { average: 'O(n²)', space: 'O(1)' },
  'Cocktail Shaker Sort': { average: 'O(n²)', space: 'O(1)' },
  'Gnome Sort': { average: 'O(n²)', space: 'O(1)' },
};

// Pseudo-code for each sort
const pseudoMap: Record<string, string> = {
  'Selection Sort':
    'for i in 0..n-1:\n  minIndex = i\n  for j in i+1..n:\n    if A[j] < A[minIndex]: minIndex = j\n  swap A[i], A[minIndex]',
  'Insertion Sort':
    'for i in 1..n-1:\n  key = A[i]\n  j = i-1\n  while j>=0 and A[j] > key:\n    A[j+1] = A[j]\n    j--\n  A[j+1] = key',
  'Quick Sort':
    'quickSort(A, low, high):\n  if low < high:\n    pi = partition(A, low, high)\n    quickSort(A, low, pi-1)\n    quickSort(A, pi+1, high)',
  'Merge Sort':
    'mergeSort(A, l, r):\n  if l < r:\n    m = (l + r)//2\n    mergeSort(A, l, m)\n    mergeSort(A, m+1, r)\n    merge(A, l, m, r)',
  'Heap Sort':
    'heapSort(A):\n  buildMaxHeap(A)\n  for i=n-1..1:\n    swap A[0], A[i]\n    heapify(A, 0, i)',
  'Radix Sort':
    'radixSort(A):\n  maxVal = max(A)\n  exp = 1\n  while maxVal/exp > 0:\n    countingSort(A, exp)\n    exp *= 10',
  'Shell Sort':
    'shellSort(A):\n  gap = n/2\n  while gap > 0:\n    for i=gap..n-1:\n      temp = A[i]\n      j = i\n      while j>=gap and A[j-gap]>temp:\n        A[j] = A[j-gap]\n        j -= gap\n      A[j] = temp\n    gap /= 2',
  'Bubble Sort':
    'bubbleSort(A):\n  for i=0..n-1:\n    for j=0..n-i-2:\n      if A[j]>A[j+1]: swap A[j], A[j+1]',
  'Cocktail Shaker Sort':
    'cocktailShakerSort(A):\n  swapped = true\n  start = 0\n  end = n-1\n  while swapped:\n    swapped = false\n    for i=start..end-1:\n      if A[i] > A[i+1]: swap\n    end--\n    for i=end-1..start:\n      if A[i] > A[i+1]: swap\n    start++',
  'Gnome Sort':
    'gnomeSort(A):\n  i = 0\n  while i < n:\n    if i==0 or A[i] >= A[i-1]: i++\n    else:\n      swap A[i], A[i-1]\n      i--',
};

// Configuration for lil-gui
const config = {
  chosenAlgo: 'Quick Sort',
  chosenShader: 'Phong Shader',
  speed: 50,
  beginSort: () => startSorter(),
  haltSort: () => stopSorter(),
  randomizeDataset: () => {
    if (isSorting) return;
    randomizeData();
    createBlocks();
  },
  arrayAccesses: 0,
  comparisons: 0,
  elapsedTime: '0.0s',
  timeComplexityAverage: '',
  spaceComplexity: '',
  backgroundColor: '#000000',
};

/**
 * ================
 * Initialization
 * ================
 */
function initializeScene(): void {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 80, 300);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  document.getElementById('render-area')?.appendChild(renderer.domElement);

  // Lights
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(0, 100, 100);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff);
  scene.add(ambientLight);

  // Audio trigger
  document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });
}

function initializeCameraControls(): void {
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
}

/**
 * Generate a shuffled array of unique integers from 1..100
 */
function randomizeData(): void {
  const arrayRange = Array.from({ length: 100 }, (_, idx) => idx + 1);
  for (let i = arrayRange.length - 1; i > 0; i--) {
    const randIndex = Math.floor(Math.random() * (i + 1));
    [arrayRange[i], arrayRange[randIndex]] = [
      arrayRange[randIndex],
      arrayRange[i],
    ];
  }
  dataset = arrayRange;
}

/**
 * Create the 3D block representation for the dataset
 */
function createBlocks(): void {
  // Clear old blocks
  blocks.forEach((block) => {
    scene.remove(block);
    block.geometry.dispose();
    if (Array.isArray(block.material)) {
      block.material.forEach((mat) => mat.dispose());
    } else {
      block.material.dispose();
    }
  });
  blocks = [];

  const blockWidth = 4;
  const gap = 1;
  const startX =
    50 + -((blockWidth + gap) * dataset.length) / 2 + (blockWidth + gap) / 2;

  for (let i = 0; i < dataset.length; i++) {
    const geometry = new THREE.BoxGeometry(blockWidth, dataset[i], blockWidth);
    const material = activeMaterial.clone();
    const block = new THREE.Mesh(geometry, material);
    block.position.x = startX + i * (blockWidth + gap);
    block.position.y = dataset[i] / 2;
    scene.add(block);
    blocks.push(block);
  }
}

/** Sleep helper to slow down steps */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Play an audio tone mapped to the data value */
function playTone(value: number): void {
  const minFreq = 100;
  const maxFreq = 1100;
  const duration = 0.05;
  const minVal = Math.min(...dataset);
  const maxVal = Math.max(...dataset);
  const range = maxVal - minVal || 1;
  const normalized = (value - minVal) / range;
  const freq = normalized * (maxFreq - minFreq) + minFreq;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0.0, now);
  gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
  gainNode.gain.linearRampToValueAtTime(0.0, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/** Swap two data values at indexes i & j */
function swapValues(i: number, j: number): void {
  arrayAccessCount += 4;
  playTone(dataset[i]);
  playTone(dataset[j]);
  const temp = dataset[i];
  dataset[i] = dataset[j];
  dataset[j] = temp;
}

/** Update the 3D block height at a given index */
function adjustBlockHeight(index: number): void {
  playTone(dataset[index]);
  const block = blocks[index];
  const newHeight = dataset[index];
  block.scale.y =
    newHeight / (block.geometry as THREE.BoxGeometry).parameters.height;
  block.position.y = newHeight / 2;
}

/** Highlight a block (visual feedback) */
function highlightBlock(index: number, color: number): void {
  const mat = blocks[index].material as THREE.ShaderMaterial;
  mat.uniforms.useOverrideColor.value = true;
  mat.uniforms.overrideColor.value.setHex(color);
}

/** Remove highlight from a block */
function clearBlockHighlight(index: number): void {
  const mat = blocks[index].material as THREE.ShaderMaterial;
  mat.uniforms.useOverrideColor.value = false;
}

/** Update GUI stats (array accesses, comparisons, etc.) */
function updateStatistics(): void {
  config.arrayAccesses = arrayAccessCount;
  config.comparisons = comparisonCount;

  let elapsed: number | string;
  if (finishTimestamp !== null) {
    elapsed = ((finishTimestamp - startTimestamp) / 1000).toFixed(2);
  } else {
    elapsed = ((performance.now() - startTimestamp) / 1000).toFixed(2);
  }
  config.elapsedTime = elapsed + 's';
}

/** Highlight final sorted array for a finishing effect */
async function highlightSorted(): Promise<void> {
  for (let i = 0; i < dataset.length; i++) {
    if (interruptRequested) break;
    highlightBlock(i, 0x00ff00);
    playTone(dataset[i]);
    await wait(100 / config.speed);
    clearBlockHighlight(i);
  }
}

/**
 * ===================
 * Sorting Algorithms
 * ===================
 */

/** Bubble Sort */
async function doBubbleSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const n = dataset.length;
  for (let i = 0; i < n - 1; i++) {
    if (interruptRequested) break;
    for (let j = 0; j < n - i - 1; j++) {
      if (interruptRequested) break;
      highlightBlock(j, 0xff0000);
      highlightBlock(j + 1, 0xff0000);
      interval = Math.max(1, 100 / config.speed);
      await wait(interval);
      comparisonCount++;
      arrayAccessCount += 2;

      playTone(dataset[j]);
      playTone(dataset[j + 1]);

      if (dataset[j] > dataset[j + 1]) {
        swapValues(j, j + 1);
        adjustBlockHeight(j);
        adjustBlockHeight(j + 1);
      }
      clearBlockHighlight(j);
      clearBlockHighlight(j + 1);
      updateStatistics();
    }
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/** Selection Sort */
async function doSelectionSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const n = dataset.length;
  for (let i = 0; i < n - 1; i++) {
    if (interruptRequested) break;
    let minIdx = i;
    highlightBlock(minIdx, 0x00ff00);
    playTone(dataset[minIdx]);

    for (let j = i + 1; j < n; j++) {
      if (interruptRequested) break;
      highlightBlock(j, 0xff0000);
      interval = Math.max(1, 100 / config.speed);
      await wait(interval);
      comparisonCount++;
      arrayAccessCount += 2;
      playTone(dataset[j]);
      playTone(dataset[minIdx]);

      if (dataset[j] < dataset[minIdx]) {
        clearBlockHighlight(minIdx);
        minIdx = j;
        highlightBlock(minIdx, 0x00ff00);
        playTone(dataset[minIdx]);
      } else {
        clearBlockHighlight(j);
      }
      updateStatistics();
    }
    if (minIdx !== i) {
      swapValues(i, minIdx);
      adjustBlockHeight(i);
      adjustBlockHeight(minIdx);
    }
    clearBlockHighlight(minIdx);
    clearBlockHighlight(i);
    updateStatistics();
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/** Insertion Sort */
async function doInsertionSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const n = dataset.length;
  for (let i = 1; i < n; i++) {
    if (interruptRequested) break;
    const key = dataset[i];
    arrayAccessCount++;
    playTone(key);

    let j = i - 1;
    highlightBlock(i, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    while (j >= 0 && !interruptRequested) {
      comparisonCount++;
      arrayAccessCount += 2;
      playTone(dataset[j]);
      playTone(key);

      if (dataset[j] > key) {
        dataset[j + 1] = dataset[j];
        arrayAccessCount += 2;
        adjustBlockHeight(j + 1);
        highlightBlock(j, 0xff0000);
        interval = Math.max(1, 100 / config.speed);
        await wait(interval);
        clearBlockHighlight(j + 1);
        j--;
      } else {
        break;
      }
      updateStatistics();
    }
    dataset[j + 1] = key;
    arrayAccessCount++;
    adjustBlockHeight(j + 1);
    clearBlockHighlight(j + 1);
    clearBlockHighlight(i);
    updateStatistics();
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/** Quick Sort */
async function doQuickSort(low = 0, high = dataset.length - 1): Promise<void> {
  if (interruptRequested) return;

  if (!isSorting) {
    // We only set these once at the very start
    isSorting = true;
    interruptRequested = false;
    arrayAccessCount = 0;
    comparisonCount = 0;
    startTimestamp = performance.now();
    finishTimestamp = null;
    updateStatistics();
  }

  await quickSortHelper(low, high);

  // Once the entire array is processed
  if (low === 0 && high === dataset.length - 1) {
    if (!interruptRequested) {
      finishTimestamp = performance.now();
      updateStatistics();
      await highlightSorted();
    }
    isSorting = false;
    updateStatistics();
  }
}

async function quickSortHelper(low: number, high: number): Promise<void> {
  if (interruptRequested) return;
  if (low < high) {
    const pi = await quickPartition(low, high);
    await quickSortHelper(low, pi - 1);
    await quickSortHelper(pi + 1, high);
  }
}

async function quickPartition(low: number, high: number): Promise<number> {
  if (interruptRequested) return 0;
  const pivot = dataset[high];
  arrayAccessCount++;
  playTone(pivot);

  highlightBlock(high, 0x0000ff);

  let i = low - 1;

  for (let j = low; j <= high - 1; j++) {
    if (interruptRequested) break;
    highlightBlock(j, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    comparisonCount++;
    arrayAccessCount++;
    playTone(dataset[j]);

    if (dataset[j] < pivot) {
      i++;
      swapValues(i, j);
      adjustBlockHeight(i);
      adjustBlockHeight(j);
      clearBlockHighlight(j);
    } else {
      clearBlockHighlight(j);
    }
    updateStatistics();
  }

  if (interruptRequested) return 0;
  swapValues(i + 1, high);
  adjustBlockHeight(i + 1);
  adjustBlockHeight(high);
  clearBlockHighlight(high);
  updateStatistics();
  return i + 1;
}

/** Merge Sort */
async function doMergeSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  await mergeSortHelper(0, dataset.length - 1);

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

async function mergeSortHelper(left: number, right: number): Promise<void> {
  if (interruptRequested) return;
  if (left < right) {
    const mid = Math.floor((left + right) / 2);
    await mergeSortHelper(left, mid);
    await mergeSortHelper(mid + 1, right);
    await merge(left, mid, right);
  }
}

async function merge(left: number, mid: number, right: number): Promise<void> {
  if (interruptRequested) return;

  const n1 = mid - left + 1;
  const n2 = right - mid;
  const L: number[] = [];
  const R: number[] = [];

  for (let i = 0; i < n1; i++) {
    arrayAccessCount++;
    L[i] = dataset[left + i];
    playTone(L[i]);
  }
  for (let j = 0; j < n2; j++) {
    arrayAccessCount++;
    R[j] = dataset[mid + 1 + j];
    playTone(R[j]);
  }

  let i = 0,
    j = 0,
    k = left;

  while (i < n1 && j < n2 && !interruptRequested) {
    highlightBlock(k, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    comparisonCount++;
    arrayAccessCount += 2;
    playTone(L[i]);
    playTone(R[j]);

    if (L[i] <= R[j]) {
      dataset[k] = L[i];
      arrayAccessCount++;
      adjustBlockHeight(k);
      i++;
    } else {
      dataset[k] = R[j];
      arrayAccessCount++;
      adjustBlockHeight(k);
      j++;
    }
    clearBlockHighlight(k);
    k++;
    updateStatistics();
  }

  while (i < n1 && !interruptRequested) {
    highlightBlock(k, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    dataset[k] = L[i];
    arrayAccessCount++;
    playTone(L[i]);
    adjustBlockHeight(k);
    clearBlockHighlight(k);
    i++;
    k++;
    updateStatistics();
  }

  while (j < n2 && !interruptRequested) {
    highlightBlock(k, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    dataset[k] = R[j];
    arrayAccessCount++;
    playTone(R[j]);
    adjustBlockHeight(k);
    clearBlockHighlight(k);
    j++;
    k++;
    updateStatistics();
  }
}

/** Heap Sort */
async function doHeapSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const n = dataset.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    if (interruptRequested) break;
    await heapify(n, i);
    updateStatistics();
  }

  for (let i = n - 1; i > 0; i--) {
    if (interruptRequested) break;
    swapValues(0, i);
    adjustBlockHeight(0);
    adjustBlockHeight(i);
    await heapify(i, 0);
    updateStatistics();
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

async function heapify(n: number, i: number): Promise<void> {
  if (interruptRequested) return;

  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;

  if (left < n) {
    comparisonCount++;
    arrayAccessCount += 2;
    playTone(dataset[left]);
    playTone(dataset[largest]);
    if (dataset[left] > dataset[largest]) {
      largest = left;
    }
  }

  if (right < n) {
    comparisonCount++;
    arrayAccessCount += 2;
    playTone(dataset[right]);
    playTone(dataset[largest]);
    if (dataset[right] > dataset[largest]) {
      largest = right;
    }
  }

  if (largest !== i) {
    swapValues(i, largest);
    adjustBlockHeight(i);
    adjustBlockHeight(largest);
    highlightBlock(i, 0xff0000);
    highlightBlock(largest, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);
    clearBlockHighlight(i);
    clearBlockHighlight(largest);
    await heapify(n, largest);
    updateStatistics();
  }
}

/** Radix Sort */
async function doRadixSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const maxVal = Math.max(...dataset);
  let exp = 1;

  while (Math.floor(maxVal / exp) > 0 && !interruptRequested) {
    await countingSortDigit(exp);
    exp *= 10;
    updateStatistics();
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

async function countingSortDigit(exp: number): Promise<void> {
  if (interruptRequested) return;

  const n = dataset.length;
  const output = new Array(n).fill(0);
  const count = new Array(10).fill(0);

  for (let i = 0; i < n; i++) {
    arrayAccessCount++;
    playTone(dataset[i]);
    count[Math.floor(dataset[i] / exp) % 10]++;
  }

  for (let i = 1; i < 10; i++) {
    count[i] += count[i - 1];
  }

  for (let i = n - 1; i >= 0; i--) {
    arrayAccessCount++;
    playTone(dataset[i]);
    const index = Math.floor(dataset[i] / exp) % 10;
    output[count[index] - 1] = dataset[i];
    arrayAccessCount++;
    count[index]--;
  }

  for (let i = 0; i < n; i++) {
    if (interruptRequested) break;
    dataset[i] = output[i];
    arrayAccessCount += 2;
    playTone(dataset[i]);
    adjustBlockHeight(i);
    highlightBlock(i, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);
    clearBlockHighlight(i);
    updateStatistics();
  }
}

/** Shell Sort */
async function doShellSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  const n = dataset.length;
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    if (interruptRequested) break;
    for (let i = gap; i < n; i++) {
      if (interruptRequested) break;
      const temp = dataset[i];
      arrayAccessCount++;
      playTone(temp);
      let j = i;

      highlightBlock(i, 0xff0000);

      while (j >= gap && !interruptRequested) {
        comparisonCount++;
        arrayAccessCount += 2;
        playTone(dataset[j - gap]);
        playTone(temp);

        if (dataset[j - gap] > temp) {
          dataset[j] = dataset[j - gap];
          arrayAccessCount += 2;
          adjustBlockHeight(j);
          highlightBlock(j, 0xff0000);
          interval = Math.max(1, 100 / config.speed);
          await wait(interval);
          clearBlockHighlight(j);
          j -= gap;
        } else {
          break;
        }
        updateStatistics();
      }

      dataset[j] = temp;
      arrayAccessCount++;
      adjustBlockHeight(j);
      clearBlockHighlight(i);
      updateStatistics();
    }
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/** Cocktail Shaker Sort */
async function doCocktailShakerSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  let swapped = true;
  let start = 0;
  let end = dataset.length - 1;

  while (swapped && !interruptRequested) {
    swapped = false;
    for (let i = start; i < end; i++) {
      if (interruptRequested) break;
      highlightBlock(i, 0xff0000);
      highlightBlock(i + 1, 0xff0000);
      interval = Math.max(1, 100 / config.speed);
      await wait(interval);

      comparisonCount++;
      arrayAccessCount += 2;
      playTone(dataset[i]);
      playTone(dataset[i + 1]);

      if (dataset[i] > dataset[i + 1]) {
        swapValues(i, i + 1);
        adjustBlockHeight(i);
        adjustBlockHeight(i + 1);
        swapped = true;
      }
      clearBlockHighlight(i);
      clearBlockHighlight(i + 1);
      updateStatistics();
    }
    if (!swapped) break;
    swapped = false;
    end--;

    for (let i = end - 1; i >= start; i--) {
      if (interruptRequested) break;
      highlightBlock(i, 0xff0000);
      highlightBlock(i + 1, 0xff0000);
      interval = Math.max(1, 100 / config.speed);
      await wait(interval);

      comparisonCount++;
      arrayAccessCount += 2;
      playTone(dataset[i]);
      playTone(dataset[i + 1]);

      if (dataset[i] > dataset[i + 1]) {
        swapValues(i, i + 1);
        adjustBlockHeight(i);
        adjustBlockHeight(i + 1);
        swapped = true;
      }
      clearBlockHighlight(i);
      clearBlockHighlight(i + 1);
      updateStatistics();
    }
    start++;
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/** Gnome Sort */
async function doGnomeSort(): Promise<void> {
  if (isSorting) return;
  isSorting = true;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  updateStatistics();

  let idx = 0;
  const n = dataset.length;

  while (idx < n && !interruptRequested) {
    if (idx === 0) {
      idx++;
    }
    highlightBlock(idx, 0xff0000);
    highlightBlock(idx - 1, 0xff0000);
    interval = Math.max(1, 100 / config.speed);
    await wait(interval);

    comparisonCount++;
    arrayAccessCount += 2;
    playTone(dataset[idx]);
    playTone(dataset[idx - 1]);

    if (dataset[idx] >= dataset[idx - 1]) {
      clearBlockHighlight(idx);
      clearBlockHighlight(idx - 1);
      idx++;
    } else {
      swapValues(idx, idx - 1);
      adjustBlockHeight(idx);
      adjustBlockHeight(idx - 1);
      clearBlockHighlight(idx);
      clearBlockHighlight(idx - 1);
      idx--;
    }
    updateStatistics();
  }

  if (!interruptRequested) {
    finishTimestamp = performance.now();
    updateStatistics();
    await highlightSorted();
  }
  isSorting = false;
}

/**
 * ==========================
 * Custom Shaders (GLSL)
 * ==========================
 */
const vertexShaderSource = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  const float PI = 3.1415926535897932384626433832795;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPos.xyz;

    // basic spherical coordinates
    vec3 nPos = normalize(position);
    float u = 0.5 + atan(nPos.z, nPos.x) / (2.0 * PI);
    float v = 0.5 - asin(nPos.y) / PI;
    vUv = vec2(u, v);

    gl_Position = projectionMatrix * viewPos;
  }
`;

const phongFragmentShader = `
  precision highp float;
  uniform vec3 lightPos;
  uniform vec3 lightColor;
  uniform float lightIntensity;
  uniform vec3 ambientColor;
  uniform vec3 diffuseColor;
  uniform vec3 specularColor;
  uniform float shininess;
  uniform float specularGradient;
  uniform float Ka;
  uniform float Kd;
  uniform float Ks;
  uniform vec3 baseLight;
  uniform float occlusionFactor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform bool useOverrideColor;
  uniform vec3 overrideColor;

  void main() {
    vec3 norm = normalize(vNormal);
    vec3 lightDir = normalize(lightPos - vViewPosition);
    vec3 viewDir = normalize(-vViewPosition);

    // ambient
    vec3 ambient = Ka * ambientColor;

    // diffuse
    vec3 adjustedLight = lightColor * lightIntensity;
    float diff = max(dot(norm, lightDir), occlusionFactor);
    vec3 diffuse = Kd * diff * diffuseColor * adjustedLight;

    // specular
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(norm, halfDir), 0.0), shininess);
    vec3 specular = Ks * spec * specularColor * specularGradient;

    vec3 finalColor = ambient + diffuse + specular + baseLight;
    finalColor = pow(finalColor, vec3(1.0/2.2));

    if (useOverrideColor) {
      gl_FragColor = vec4(overrideColor, 1.0);
      return;
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const iridescentFragmentShader = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform bool useOverrideColor;
  uniform vec3 overrideColor;

  void main() {
    vec3 norm = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPosition);
    float angle = dot(norm, viewDir);
    float t = (angle + 1.0) * 0.5;
    t = smoothstep(0.0, 1.0, t);
    vec3 iColor = mix(color1, color2, t);

    if (useOverrideColor) {
      gl_FragColor = vec4(overrideColor, 1.0);
      return;
    }
    gl_FragColor = vec4(iColor, 1.0);
  }
`;

const toonFragmentShader = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform vec3 lightPos;
  uniform vec3 lightColor;
  uniform float lightIntensity;
  uniform int numBands;
  uniform vec3 bandColors[10];
  uniform bool useOverrideColor;
  uniform vec3 overrideColor;

  void main() {
    vec3 norm = normalize(vNormal);
    vec3 lDir = normalize(lightPos - vViewPosition);
    float dotNL = max(dot(norm, lDir), 0.0);
    float band = floor(dotNL * float(numBands));
    int idx = int(band);
    idx = clamp(idx, 0, numBands - 1);
    vec3 color = bandColors[idx];

    if (useOverrideColor) {
      gl_FragColor = vec4(overrideColor, 1.0);
      return;
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

const shaderToyFragmentShader = `
  precision highp float;
  uniform float iTime;
  uniform float speed;
  varying vec3 vNormal;
  uniform bool useOverrideColor;
  uniform vec3 overrideColor;

  void main() {
    vec3 norm = normalize(vNormal);
    vec2 p = norm.xy;
    float a = atan(p.y, p.x);
    float r = pow(pow(p.x * p.x, 4.0) + pow(p.y * p.y, 4.0), 1.0/8.0);
    r = max(r, 0.0001);
    vec2 uv = vec2(1.0 / r + 0.2 * iTime * speed, a);
    float f = cos(12.0 * uv.x) * cos(6.0 * uv.y);
    vec3 col = 0.5 + 0.5 * sin(3.1416 * f + vec3(0.0, 0.5, 1.0));
    col = col * r;

    if (useOverrideColor) {
      gl_FragColor = vec4(overrideColor, 1.0);
      return;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const flatVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flatFragmentShader = `
  precision highp float;
  varying vec3 vNormal;
  uniform bool useOverrideColor;
  uniform vec3 overrideColor;

  void main() {
    vec3 norm = normalize(vNormal);
    vec3 color = norm * 0.5 + 0.5;
    if (useOverrideColor) {
      gl_FragColor = vec4(overrideColor, 1.0);
      return;
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Create/initialize all the available shader materials */
function initShaderMaterials(): void {
  const highlightUniforms = {
    useOverrideColor: { value: false },
    overrideColor: { value: new THREE.Color(0xffffff) },
  };

  // Phong
  const phongMat = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: phongFragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      {
        lightPos: { value: new THREE.Vector3(0, 100, 100) },
        lightColor: { value: new THREE.Color(1, 1, 1) },
        lightIntensity: { value: 1.0 },
        ambientColor: { value: new THREE.Color(0.01, 0.0, 0.0) },
        diffuseColor: { value: new THREE.Color(0.25, 0.0, 0.0) },
        specularColor: { value: new THREE.Color(1, 1, 1) },
        shininess: { value: 50.0 },
        specularGradient: { value: 0.5 },
        Ka: { value: 0.3 },
        Kd: { value: 0.7 },
        Ks: { value: 0.5 },
        baseLight: { value: new THREE.Color(0.0, 0.0, 0.0) },
        occlusionFactor: { value: 0.0 },
      },
      highlightUniforms,
    ]),
  });

  // Iridescent
  const iridescentMat = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: iridescentFragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      {
        color1: { value: new THREE.Color(1.0, 0.0, 0.0) },
        color2: { value: new THREE.Color(0.0, 0.0, 1.0) },
      },
      highlightUniforms,
    ]),
  });

  // Toon
  const toonMat = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: toonFragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      {
        lightPos: { value: new THREE.Vector3(0, 100, 100) },
        lightColor: { value: new THREE.Color(1, 1, 1) },
        lightIntensity: { value: 1.0 },
        numBands: { value: 4 },
        bandColors: {
          value: [
            new THREE.Color(0.1, 0.1, 0.1),
            new THREE.Color(0.3, 0.3, 0.3),
            new THREE.Color(0.6, 0.6, 0.6),
            new THREE.Color(0.9, 0.9, 0.9),
            new THREE.Color(1.0, 1.0, 1.0),
            new THREE.Color(1.0, 1.0, 1.0),
            new THREE.Color(1.0, 1.0, 1.0),
            new THREE.Color(1.0, 1.0, 1.0),
            new THREE.Color(1.0, 1.0, 1.0),
            new THREE.Color(1.0, 1.0, 1.0),
          ],
        },
      },
      highlightUniforms,
    ]),
  });

  // ShaderToy
  const shaderToyMat = new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: shaderToyFragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      {
        iTime: { value: 0 },
        speed: { value: 1.0 },
      },
      highlightUniforms,
    ]),
  });

  // Flat
  const flatMat = new THREE.ShaderMaterial({
    vertexShader: flatVertexShader,
    fragmentShader: flatFragmentShader,
    uniforms: THREE.UniformsUtils.merge([{}, highlightUniforms]),
  });

  materials['Phong Shader'] = phongMat;
  materials['Iridescent Shader'] = iridescentMat;
  materials['Toon Shader'] = toonMat;
  materials['ShaderToy Shader'] = shaderToyMat;
  materials['Flat Shader'] = flatMat;

  activeMaterial = phongMat; // default
}

/** Update active material based on GUI selection */
function changeMaterial(): void {
  activeMaterial = materials[config.chosenShader];
  blocks.forEach((block) => {
    const oldMat = block.material as THREE.ShaderMaterial;
    const newMat = activeMaterial.clone();
    block.material = newMat;
    oldMat.dispose();
  });
}

/**
 * =================
 * GUI Setup (lil-gui)
 * =================
 */
function initControlPanel(): void {
  gui = new GUI({ autoPlace: false });
  const container = document.getElementById('gui-container');
  if (container) container.appendChild(gui.domElement);

  // Sorting algorithm
  gui
    .add(config, 'chosenAlgo', [
      'Selection Sort',
      'Insertion Sort',
      'Quick Sort',
      'Merge Sort',
      'Heap Sort',
      'Radix Sort',
      'Shell Sort',
      'Bubble Sort',
      'Cocktail Shaker Sort',
      'Gnome Sort',
    ])
    .onChange(() => {
      updateComplexities();
    });

  // Shader
  gui.add(config, 'chosenShader', Object.keys(materials)).onChange(() => {
    changeMaterial();
  });

  // Background
  gui
    .addColor(config, 'backgroundColor')
    .name('Background')
    .onChange((val: string) => {
      renderer.setClearColor(new THREE.Color(val), 1);
      document.body.style.backgroundColor = val;
    });

  // Speed
  gui.add(config, 'speed', 0.1, 100);

  // Array generation
  gui.add(config, 'randomizeDataset').name('Generate Array');

  // Start/Stop
  gui.add(config, 'beginSort').name('Begin Sorting');
  gui.add(config, 'haltSort').name('Stop Sorting');

  // Info: complexities + stats
  gui.add(config, 'timeComplexityAverage').name('Time Complexity').listen();
  gui.add(config, 'spaceComplexity').name('Space Complexity').listen();
  gui.add(config, 'arrayAccesses').name('Array Accesses').listen();
  gui.add(config, 'comparisons').name('Comparisons').listen();
  gui.add(config, 'elapsedTime').name('Elapsed Time').listen();
}

/** Update displayed complexities and pseudo-code */
function updateComplexities(): void {
  const c = complexityMap[config.chosenAlgo];
  config.timeComplexityAverage = c.average;
  config.spaceComplexity = c.space;

  const pseudo = pseudoMap[config.chosenAlgo];
  const infoBox = document.getElementById('info-box');
  if (infoBox) {
    infoBox.textContent = 'Pseudo Code\n\n' + pseudo;
  }
}

/** Handle window resizing */
function handleResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/** Request animation loop */
function animationLoop(): void {
  requestAnimationFrame(animationLoop);
  orbitControls.update();

  // Animate "ShaderToy Shader" if present
  if (materials['ShaderToy Shader']) {
    materials['ShaderToy Shader'].uniforms.iTime.value =
      performance.now() / 1000;
  }
  renderer.render(scene, camera);
}

/** Start the sorting process according to the chosen algorithm */
function startSorter(): void {
  if (isSorting) return;
  interruptRequested = false;
  arrayAccessCount = 0;
  comparisonCount = 0;
  startTimestamp = performance.now();
  finishTimestamp = null;
  config.arrayAccesses = arrayAccessCount;
  config.comparisons = comparisonCount;
  config.elapsedTime = '0.0s';

  switch (config.chosenAlgo) {
    case 'Selection Sort':
      doSelectionSort();
      break;
    case 'Insertion Sort':
      doInsertionSort();
      break;
    case 'Quick Sort':
      doQuickSort();
      break;
    case 'Merge Sort':
      doMergeSort();
      break;
    case 'Heap Sort':
      doHeapSort();
      break;
    case 'Radix Sort':
      doRadixSort();
      break;
    case 'Shell Sort':
      doShellSort();
      break;
    case 'Bubble Sort':
      doBubbleSort();
      break;
    case 'Cocktail Shaker Sort':
      doCocktailShakerSort();
      break;
    case 'Gnome Sort':
      doGnomeSort();
      break;
  }
}

/** Stop/interrupt current sorting */
function stopSorter(): void {
  if (!isSorting) return;
  interruptRequested = true;
  finishTimestamp = performance.now();
  updateStatistics();
}

/** Main initialization */
function initialize(): void {
  initializeScene();
  initializeCameraControls();
  initShaderMaterials();
  initControlPanel();
  randomizeData();
  createBlocks();
  updateComplexities();
  window.addEventListener('resize', handleResize, false);
  animationLoop();
}

// Start it up!
initialize();
