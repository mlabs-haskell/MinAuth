import Head from 'next/head';
import GradientBG from '../components/GradientBG.js';
import React from 'react';
import MinAuthDemo from './minauth-demo';

export default function Home() {
  return (
    <>
      <Head>
        <title>Mina zkApp UI</title>
        <meta name="description" content="built with o1js" />
        <link rel="icon" href="/assets/favicon.ico" />
      </Head>
      <GradientBG>
        <div className="flex flex-col items-center w-full min-h-screen bg-gray-800 text-white p-5 my-8 mx-auto">
          <MinAuthDemo />
        </div>
      </GradientBG>
    </>
  );
}
