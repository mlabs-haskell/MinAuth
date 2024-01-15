import Head from 'next/head';
import GradientBG from '../components/GradientBG.js';
import React from 'react';
import MinAuthDemo from './minauth-demo';
import 'tailwindcss/tailwind.css';

export default function Home() {
  return (
    <>
      <Head>
        <title>Mina zkApp UI</title>
        <meta name="description" content="built with o1js" />
        <link rel="icon" href="/assets/favicon.ico" />
      </Head>
      <GradientBG>
        <div className="flex flex-col items-center w-full bg-gray-800 bg-opacity-50 min-h-screen p-5 mx-auto">
          <MinAuthDemo />
        </div>
      </GradientBG>
    </>
  );
}
