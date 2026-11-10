import { NextRequest, NextResponse } from 'next/server';

interface WhatsAppContactRequest {
  name: string;
  phone: string;
  timestamp: string;
}

interface WhatsAppConfig {
  enabled: boolean;
  forwardUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

const getWhatsAppConfig = (): WhatsAppConfig => {
  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key to Authorization header if provided
  if (process.env.WHATSAPP_API_KEY) {
    customHeaders['Authorization'] = `Bearer ${process.env.WHATSAPP_API_KEY}`;
  }

  // Parse and add custom headers if provided
  if (process.env.WHATSAPP_CUSTOM_HEADERS) {
    try {
      const parsedHeaders = JSON.parse(process.env.WHATSAPP_CUSTOM_HEADERS);
      Object.assign(customHeaders, parsedHeaders);
    } catch (error) {
      console.error('Failed to parse WHATSAPP_CUSTOM_HEADERS:', error);
    }
  }

  return {
    enabled: process.env.WHATSAPP_FORWARD_ENABLED === 'true',
    forwardUrl: process.env.WHATSAPP_FORWARD_URL,
    apiKey: process.env.WHATSAPP_API_KEY,
    headers: customHeaders,
  };
};

const validateRequest = (data: any): data is WhatsAppContactRequest => {
  return (
    typeof data === 'object' &&
    typeof data.name === 'string' &&
    typeof data.phone === 'string' &&
    typeof data.timestamp === 'string' &&
    data.name.trim().length > 0 &&
    data.phone.trim().length > 0
  );
};

const transformPayload = (data: WhatsAppContactRequest) => {
  const transformType = process.env.WHATSAPP_PAYLOAD_TRANSFORM || 'default';
  
  switch (transformType) {
    case 'webhook':
      return {
        event: 'whatsapp_contact',
        data: {
          contact: {
            name: data.name,
            phone: data.phone,
          },
          timestamp: data.timestamp,
          source: 'landing_page',
        },
      };
    
    case 'crm':
      const nameParts = data.name.trim().split(' ');
      return {
        lead: {
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: data.phone,
          source: 'WhatsApp Widget',
          tags: ['whatsapp', 'landing-page'],
        },
        createdAt: data.timestamp,
      };
    
    case 'custom':
      try {
        const customTransform = process.env.WHATSAPP_CUSTOM_TRANSFORM;
        if (customTransform) {
          const template = JSON.parse(customTransform);
          const jsonString = JSON.stringify(template)
            .replace(/\{\{name\}\}/g, data.name)
            .replace(/\{\{phone\}\}/g, data.phone)
            .replace(/\{\{timestamp\}\}/g, data.timestamp);
          return JSON.parse(jsonString);
        }
      } catch (error) {
        console.error('Error applying custom transform:', error);
      }
      return data;
    
    default:
      return data;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    if (!validateRequest(body)) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          message: 'Name and phone are required and must be non-empty strings',
          received: {
            name: typeof body.name,
            phone: typeof body.phone,
            timestamp: typeof body.timestamp
          }
        },
        { status: 400 }
      );
    }

    const config = getWhatsAppConfig();
    
    // Log the contact submission
    const logData = {
      name: body.name,
      phone: body.phone,
      timestamp: body.timestamp,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      forwarding: config.enabled,
    };
    
    console.log('WhatsApp contact received:', logData);

    let forwardingResult = null;

    // Forward to external service if enabled
    if (config.enabled && config.forwardUrl) {
      try {
        const transformedPayload = transformPayload(body);
        
        console.log('Forwarding to:', config.forwardUrl);
        console.log('Payload:', transformedPayload);
        console.log('Headers:', config.headers);

        const forwardResponse = await fetch(config.forwardUrl, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify(transformedPayload),
        });

        const responseText = await forwardResponse.text();
        
        if (forwardResponse.ok) {
          console.log('Successfully forwarded WhatsApp contact:', {
            status: forwardResponse.status,
            url: config.forwardUrl,
            response: responseText.substring(0, 200), // Log first 200 chars
          });
          
          forwardingResult = {
            success: true,
            status: forwardResponse.status,
            response: responseText,
          };
        } else {
          console.error('Failed to forward WhatsApp contact:', {
            status: forwardResponse.status,
            statusText: forwardResponse.statusText,
            url: config.forwardUrl,
            response: responseText,
          });
          
          forwardingResult = {
            success: false,
            status: forwardResponse.status,
            error: responseText,
          };
        }
      } catch (forwardError) {
        console.error('Error forwarding WhatsApp contact:', forwardError);
        
        forwardingResult = {
          success: false,
          error: forwardError instanceof Error ? forwardError.message : 'Unknown error',
        };
      }
    }

    // Always return success to frontend (don't fail if forwarding fails)
    return NextResponse.json({
      success: true,
      message: 'Contact received successfully',
      timestamp: new Date().toISOString(),
      contact: {
        name: body.name,
        phone: body.phone,
      },
      forwarding: forwardingResult,
    });

  } catch (error) {
    console.error('Error processing WhatsApp contact:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = getWhatsAppConfig();
  
  return NextResponse.json({
    service: 'WhatsApp Contact API',
    status: 'active',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      forwardingEnabled: config.enabled,
      hasForwardUrl: !!config.forwardUrl,
      hasApiKey: !!config.apiKey,
      forwardUrl: config.forwardUrl ? 
        config.forwardUrl.replace(/\/+$/, '') : // Remove trailing slashes for display
        null,
      payloadTransform: process.env.WHATSAPP_PAYLOAD_TRANSFORM || 'default',
      customHeadersCount: process.env.WHATSAPP_CUSTOM_HEADERS ? 
        Object.keys(JSON.parse(process.env.WHATSAPP_CUSTOM_HEADERS || '{}')).length : 0,
    },
  });
}