import { Vector } from './app';

export type VectorSource = 'text' | 'image' | 'audio' | 'custom' | 'backend';
export type ModelType =
  | 'bert'
  | 'clip'
  | 'resnet'
  | 'wav2vec'
  | 'custom'
  | 'bert-large'
  | 'text-embedding-ada-002'
  | 'unknown';

export interface VectorMetadata {
  id: string;
  source: VectorSource;
  model: ModelType;
  timestamp: string;
  description: string;
  labels: string[];
  originalContent?: {
    type: string;
    value: string;
    url?: string;
  };
  stats?: {
    magnitude: number;
    sparsity: number;
    min: number;
    max: number;
  };
}

export interface EnhancedVector {
  vector: Vector;
  metadata: VectorMetadata;
}

export interface VectorCollection {
  id: string;
  name: string;
  description: string;
  vectors: EnhancedVector[];
  dimension: number;
  created: string;
  updated: string;
  stats: {
    totalVectors: number;
    averageMagnitude: number;
    averageSparsity: number;
  };
}

export interface SearchOptions {
  algorithm: 'hnsw' | 'annoy' | 'faiss';
  maxResults: number;
  filters?: {
    sources?: VectorSource[];
    models?: ModelType[];
    labels?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export interface EnhancedSearchResult {
  vector: Vector;
  metadata: VectorMetadata;
  similarity: number;
  algorithmSpecific: {
    distanceMetric: string;
    searchTime: number;
  };
}

// Vector templates for different models
export const vectorTemplates = {
  'bert-base': {
    title: 'BERT Base',
    description: 'BERT base model embeddings (768 dimensions)',
    dimension: 768,
    model: 'bert' as ModelType
  },
  'clip': {
    title: 'CLIP',
    description: 'OpenAI CLIP image embeddings (768 dimensions)',
    dimension: 768,
    model: 'clip' as ModelType
  },
  'bert-large': {
    title: 'BERT Large',
    description: 'BERT large model embeddings (1024 dimensions)',
    dimension: 1024,
    model: 'bert-large' as ModelType
  },
  'text-embedding-ada-002': {
    title: 'OpenAI Ada 002',
    description: 'OpenAI text-embedding-ada-002 (1536 dimensions)',
    dimension: 1536,
    model: 'text-embedding-ada-002' as ModelType
  },
  'resnet': {
    title: 'ResNet',
    description: 'ResNet image features (2048 dimensions)',
    dimension: 2048,
    model: 'resnet' as ModelType
  },
  'wav2vec': {
    title: 'Wav2Vec',
    description: 'Wav2Vec audio embeddings (768 dimensions)',
    dimension: 768,
    model: 'wav2vec' as ModelType
  }
};

// Generate a large array of text samples
const generateTextSamples = (): Partial<EnhancedVector>[] => {
  const topics = [
    ['technology', 'AI advances in healthcare show promising results for early disease detection.'],
    ['science', 'New research reveals potential breakthrough in quantum computing efficiency.'],
    ['programming', 'Modern JavaScript frameworks emphasize component-based architecture.'],
    ['medicine', 'Clinical trials demonstrate effectiveness of personalized immunotherapy.'],
    ['business', 'Startup revolutionizes supply chain management with blockchain technology.'],
    ['education', 'Online learning platforms adapt AI-powered personalized curriculum.'],
    ['environment', 'Innovative carbon capture technology shows significant efficiency gains.'],
    ['space', 'Mars rover discovers new evidence of ancient water formations.'],
    ['robotics', 'Autonomous robots improve warehouse operations efficiency by 300%.'],
    ['cybersecurity', 'New encryption method provides quantum-resistant data protection.'],
    ['biology', 'CRISPR gene editing technique achieves precise DNA modifications.'],
    ['physics', 'Researchers observe novel quantum phenomenon in superconductors.'],
    ['chemistry', 'Novel catalyst enables efficient hydrogen fuel production.'],
    ['astronomy', 'Telescope captures detailed images of distant galaxy formation.'],
    ['neuroscience', 'Brain-computer interface achieves high-bandwidth neural communication.'],
    ['mathematics', 'New algorithm solves complex optimization problems efficiently.'],
    ['engineering', 'Advanced materials enable more efficient solar energy capture.'],
    ['agriculture', 'Vertical farming technology increases crop yield while reducing water usage.'],
    ['transportation', 'Electric autonomous vehicles demonstrate improved safety metrics.'],
    ['energy', 'Fusion reactor prototype achieves sustained plasma containment.']
  ];

  return topics.flatMap((topic, i) => {
    const variations = [
      `Latest developments in ${topic[0]}: ${topic[1]}`,
      `Research breakthrough: ${topic[1]}`,
      `New study in ${topic[0]} field: ${topic[1]}`,
      `${topic[0].charAt(0).toUpperCase() + topic[0].slice(1)} innovation: ${topic[1]}`,
      `Groundbreaking ${topic[0]} research: ${topic[1]}`
    ];

    return variations.map((content, j) => ({
      metadata: {
        id: `text-${i * 5 + j + 1}`,
        source: 'text' as VectorSource,
        model: 'bert' as ModelType,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: `${topic[0].charAt(0).toUpperCase() + topic[0].slice(1)} research article`,
        labels: ['research', topic[0], 'article', 'science'],
        originalContent: {
          type: 'text',
          value: content
        }
      }
    }));
  });
};

// Generate a large array of image samples
const generateImageSamples = (): Partial<EnhancedVector>[] => {
  const subjects = [
    ['nature', 'landscape', 'Mountain vista with snow-capped peaks'],
    ['urban', 'architecture', 'Modern skyscraper with geometric patterns'],
    ['art', 'painting', 'Abstract expressionist artwork with vibrant colors'],
    ['technology', 'product', 'Next-generation smartphone design'],
    ['science', 'microscopy', 'Electron microscope image of cellular structure'],
    ['space', 'astronomy', 'Nebula captured by space telescope'],
    ['wildlife', 'animals', 'Lion in natural savanna habitat'],
    ['portrait', 'photography', 'Environmental portrait in natural light'],
    ['aerial', 'drone', 'Aerial view of coastal cityscape'],
    ['industrial', 'engineering', 'Complex machinery in modern factory'],
    ['sports', 'action', 'High-speed capture of athletic performance'],
    ['fashion', 'style', 'Editorial fashion photography'],
    ['food', 'culinary', 'Gourmet dish presentation'],
    ['travel', 'destination', 'Ancient temple at sunset'],
    ['automotive', 'transport', 'Electric vehicle prototype']
  ];

  return subjects.flatMap((subject, i) => {
    const variations = [
      `${subject[2]} - wide angle`,
      `${subject[2]} - close-up`,
      `${subject[2]} - detail shot`,
      `${subject[2]} - alternative view`
    ];

    return variations.map((desc, j) => ({
      metadata: {
        id: `img-${i * 4 + j + 1}`,
        source: 'image' as VectorSource,
        model: 'clip' as ModelType,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: desc,
        labels: [subject[0], subject[1], 'visual', 'image'],
        originalContent: {
          type: 'image',
          value: '[base64 thumbnail]',
          url: `/images/${subject[0]}${i * 4 + j + 1}.jpg`
        }
      }
    }));
  });
};

// Generate a large array of audio samples
const generateAudioSamples = (): Partial<EnhancedVector>[] => {
  const audioTypes = [
    ['music', 'classical', 'Symphony orchestra performance'],
    ['speech', 'presentation', 'Technical conference keynote'],
    ['nature', 'ambient', 'Rainforest environmental recording'],
    ['podcast', 'interview', 'Tech industry leader discussion'],
    ['soundscape', 'urban', 'City street atmosphere'],
    ['music', 'electronic', 'Synthesizer composition'],
    ['voice', 'audiobook', 'Novel narration'],
    ['sound-effects', 'foley', 'Movie sound design'],
    ['music', 'jazz', 'Live jazz ensemble'],
    ['conference', 'panel', 'Expert panel discussion']
  ];

  return audioTypes.flatMap((type, i) => {
    const variations = [
      `${type[2]} - full recording`,
      `${type[2]} - segment 1`,
      `${type[2]} - segment 2`,
      `${type[2]} - highlights`
    ];

    return variations.map((desc, j) => ({
      metadata: {
        id: `audio-${i * 4 + j + 1}`,
        source: 'audio' as VectorSource,
        model: 'wav2vec' as ModelType,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: desc,
        labels: [type[0], type[1], 'audio', 'sound'],
        originalContent: {
          type: 'audio',
          value: `Transcription of ${desc.toLowerCase()}`,
          url: `/audio/${type[0]}${i * 4 + j + 1}.wav`
        }
      }
    }));
  });
};

// Sample vector collections for different use cases
export const sampleCollections: Record<string, Partial<EnhancedVector>[]> = {
  textEmbeddings: generateTextSamples(),     // 100 text samples
  imageFeatures: generateImageSamples(),      // 60 image samples
  audioEmbeddings: generateAudioSamples()     // 40 audio samples
};
