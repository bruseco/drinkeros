import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoHeadProps {
  title: string;
  description: string;
  path: string; // e.g. "/login" or "/drinkeros-xperience"
  image?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: object | object[];
}

const BASE = 'https://drinkeros.com';

export const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description,
  path,
  image = `${BASE}/og-image.png`,
  type = 'website',
  jsonLd,
}) => {
  const url = `${BASE}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default SeoHead;
