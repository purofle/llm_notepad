'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type Cropper from 'cropperjs';

type UploadState = {
  fileUrl: string;
  fileName: string;
};

async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  quality = 0.85,
) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        reject(new Error('裁剪结果生成失败'));
      },
      'image/jpeg',
      quality,
    );
  });

  return new File([blob], fileName, { type: 'image/jpeg' });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('先拍照，再裁剪，最后上传');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [baseFileName, setBaseFileName] = useState('photo');

  useEffect(() => {
    return () => {
      cropperRef.current?.destroy();

      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current);
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sourceImageUrl || !imageLoaded || !imageRef.current) {
      return;
    }

    let disposed = false;

    async function initCropper() {
      const { default: CropperConstructor } = await import('cropperjs');

      if (disposed || !imageRef.current) {
        return;
      }

      cropperRef.current?.destroy();
      cropperRef.current = new CropperConstructor(imageRef.current, {
        container: imageRef.current.parentElement ?? undefined,
      });
    }

    initCropper();

    return () => {
      disposed = true;
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [imageLoaded, sourceImageUrl]);

  function resetSource(url: string, fileName: string) {
    cropperRef.current?.destroy();

    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
    }

    sourceUrlRef.current = url;
    setSourceImageUrl(url);
    setBaseFileName(fileName.replace(/\.[^.]+$/, '') || 'photo');
    setImageLoaded(false);
    setUploadState(null);
    setMessage('调整裁剪区域后点击上传');
  }

  function resetPreview(url: string | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('请选择图片文件');
      event.target.value = '';
      return;
    }

    resetSource(URL.createObjectURL(file), file.name);
    resetPreview(null);
    event.target.value = '';
  }

  async function handleUpload() {
    const cropperSelection = cropperRef.current?.getCropperSelection();

    if (!cropperSelection) {
      setMessage('图片还没准备好，请重新拍照');
      return;
    }

    setIsUploading(true);
    setMessage('正在生成裁剪图片并上传...');

    try {
      const canvas = await cropperSelection.$toCanvas();
      const file = await canvasToJpegFile(canvas, `${baseFileName}.jpg`);

      resetPreview(URL.createObjectURL(file));

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '上传失败');
      }

      setUploadState({
        fileName: result.fileName,
        fileUrl: result.fileUrl,
      });
      setMessage('裁剪后的 JPG 已上传');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">拍照裁剪上传</h1>
          <p className="text-sm text-zinc-600">{message}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-amber-300 px-5 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-200"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {sourceImageUrl ? '重新拍照/选图' : '拍照并选择图片'}
          </button>

          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            onClick={handleUpload}
            disabled={!sourceImageUrl || !imageLoaded || isUploading}
          >
            {isUploading ? '上传中...' : '裁剪后上传'}
          </button>
        </div>

        {sourceImageUrl ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-700">裁剪区域</h2>
            <div className="cropper-shell overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={sourceImageUrl}
                alt="待裁剪图片"
                className="block max-w-full"
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          </section>
        ) : null}

        {previewUrl ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-700">上传预览</h2>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
              <Image
                src={previewUrl}
                alt="裁剪后图片预览"
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {uploadState ? (
              <a
                href={uploadState.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 underline underline-offset-2"
              >
                查看已上传文件：{uploadState.fileName}
              </a>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
