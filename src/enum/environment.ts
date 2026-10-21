export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum ServerMode {
  HTTP = 'http',
  HTTPS = 'https',
}

export enum VectorDbType {
  CHROMA = 'chroma',
  PINECONE = 'pinecone',
  QDRANT = 'qdrant',
  MONGODB_ATLAS = 'mongodb_atlas',
  MEMORY = 'memory',
}
