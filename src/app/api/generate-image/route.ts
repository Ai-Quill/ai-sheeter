/**
 * Image Generation Endpoint
 * 
 * Supports:
 * - DALL-E 3 (via OpenAI SDK)
 * - Google Imagen (via AI SDK @ai-sdk/google)
 * - Stratico (OpenAI-compatible API)
 * 
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
 */

import { NextResponse } from 'next/server';
import { generateImage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { decryptApiKey } from '@/utils/encryption';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function uploadToS3(imageBuffer: Buffer, userId: string, fileName: string): Promise<string> {
  if (!S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not defined in environment variables');
  }

  const key = `users/${userId}/${fileName}`;
  const uploadParams = {
    Bucket: S3_BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/png',
    ACL: 'public-read' as const,
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload image to S3');
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { model, prompt, userId, encryptedApiKey, specificModel } = await req.json();

    if (!model || !prompt || !userId || !encryptedApiKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const decryptedApiKey = decryptApiKey(encryptedApiKey);

    if (!decryptedApiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    let imageBuffer: Buffer;

    switch (model) {
      case 'DALLE':
        try {
          const openai = new OpenAI({ apiKey: decryptedApiKey });
          const dalleResponse = await openai.images.generate({
            model: specificModel || "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
          });
          if (!dalleResponse.data || !dalleResponse.data[0]?.b64_json) {
            throw new Error('No image data received from DALL-E');
          }
          imageBuffer = Buffer.from(dalleResponse.data[0].b64_json, 'base64');
        } catch (error) {
          console.error('Error generating image with DALL-E:', error);
          return NextResponse.json({ error: 'Failed to generate image with DALL-E' }, { status: 500 });
        }
        break;

      case 'GEMINI':
      case 'IMAGEN':
        // Google Imagen via AI SDK
        // @see https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
        try {
          const google = createGoogleGenerativeAI({ apiKey: decryptedApiKey });
          const imagenModel = specificModel || 'imagen-4.0-generate-001';
          
          const { image } = await generateImage({
            model: google.image(imagenModel),
            prompt: prompt,
            aspectRatio: '1:1', // Default square, can be: 1:1, 3:4, 4:3, 9:16, 16:9
          });
          
          // image.base64 contains the base64-encoded image
          if (!image.base64) {
            throw new Error('No image data received from Imagen');
          }
          imageBuffer = Buffer.from(image.base64, 'base64');
        } catch (error) {
          console.error('Error generating image with Imagen:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json({ 
            error: `Failed to generate image with Imagen: ${errorMessage}` 
          }, { status: 500 });
        }
        break;

      case 'STRATICO':
        try {
          const straticoUrl = 'https://api.stratico.com/v1/images/generations';
          const straticoHeaders = {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json'
          };
          const straticoPayload = {
            model: specificModel || 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
          };

          const straticoResponse = await axios.post(straticoUrl, straticoPayload, { headers: straticoHeaders });
          if (!straticoResponse.data.data[0].b64_json) {
            throw new Error('No image data received from Stratico');
          }
          imageBuffer = Buffer.from(straticoResponse.data.data[0].b64_json, 'base64');
        } catch (error) {
          console.error('Error generating image with Stratico:', error);
          return NextResponse.json({ error: 'Failed to generate image with Stratico' }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Unsupported model' }, { status: 400 });
    }

    const fileName = `${uuidv4()}.png`;
    const imageUrl = await uploadToS3(imageBuffer, userId, fileName);

    const { error } = await supabaseAdmin
      .from('generated_images')
      .insert({ url: imageUrl, user_id: userId, model: model });

    if (error) throw error;

    return NextResponse.json({ imageUrl });
  } catch (error: unknown) {
    console.error('Error generating image:', error);
    return NextResponse.json({ 
      error: 'Failed to generate image: ' + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}
