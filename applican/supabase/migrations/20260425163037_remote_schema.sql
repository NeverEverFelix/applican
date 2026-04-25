CREATE INDEX embeddings_embedding_hnsw_cosine_idx ON public.embeddings USING hnsw (embedding public.vector_cosine_ops);


