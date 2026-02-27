export interface FileUploaderEventHandle {
    onSuccess(): void
    onError(err: Error): void
    onProgress: (progress: number) => void
}