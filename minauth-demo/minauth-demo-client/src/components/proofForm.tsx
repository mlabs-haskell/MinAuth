import { getProofBuilderMetadata } from '@/lib/programInterfacing';
import { useEffect, useState } from 'react';
import { AutoForm, Bridge } from 'uniforms';
import SimpleSchema2Bridge from 'uniforms-bridge-simple-schema-2';

export default function ProofPage() {
  const [schema, setSchema] = useState<Bridge | null>(null);

  useEffect(() => {
    (async () => {
      const metadata = await getProofBuilderMetadata();
      const bridge = new SimpleSchema2Bridge(metadata);
      setSchema(bridge);
    })();
  }, []);

  const handleProofSubmission = (data: unknown) => {
    // Generate the proof and send it to the server.
    console.log(data);
    /* const proof = generateProof(data); // Assuming generateProof is a method you have. */
    /* submitProofToServer(proof); // This will send proof to the server and handle JWT. */
  };

  if (!schema) return <div>Loading...</div>;

  return <AutoForm schema={schema} onSubmit={handleProofSubmission} />;
}
