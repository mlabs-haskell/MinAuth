/* import React, { useEffect, useState } from 'react';
 * import Link from 'next/link';
 * import ProverDemoContainer from '../components/proverDemoContainer';
 * import { PublicInputList } from '@/app/services/pluginType';
 *
 *
 * const SimplePreimagePage: React.FC = () => {
 *
 *     // list of public inputs
 *     const [publicInputs, setPublicInputs] = useState<PublicInputList>([]);
 *
 *     useEffect(() => {
 *         // Set the public inputs
 *         const pis = await
 *
 *         setPublicInputs([
 *             {
 *
 *
 *
 *
 *     useEffect(() => {}); // CONTINUE
 *
 *     const handleAction = () => {
 *         // Simulate processing or calling some functions to generate proof, etc.
 *         setOutputData('Sample Output Data after pressing the button');
 *     };
 *
 *     const mockForm = (
 *         <div>
 *         <p>Mock form component here.Replace this with actual form components as needed.</ p >
 *             </div>
 *     );
 *
 * const footerLink = (
 *     <Link href= "/" > Back to Landing Page</Link>
 *     );
 *
 * return (
 *     <ProverDemoContainer
 *             title="Schema 1 Demo"
 *             description="This is a demonstration for Schema 1 proof generation."
 *             formComponent={mockForm}
 *             onAction={handleAction}
 *             actionLabel="Generate Proof"
 *             output={outputData}
 *             footerContent={footerLink}
 *         />
 *     );
 * }
 *
 * export default SimplePreimagePage;
 *  */
/* import { RJSFSchema, UiSchema } from '@rjsf/utils';
 * import validator from '@rjsf/validator-ajv8';
 * import ProverDemoContainer from '../components/proverDemoContainer';
 * import Form from '@rjsf/core'; */

// Using the default Bootstrap theme from react-jsonschema-form

const SimplePreimagePage: React.FC = () => {
  /* const schema: RJSFSchema = {
   *   title: 'A simple form',
   *   type: 'object',
   *   required: ['firstName', 'lastName'],
   *   properties: {
   *     firstName: {
   *       type: 'string',
   *       title: 'First name'
   *     },
   *     lastName: {
   *       type: 'string',
   *       title: 'Last name'
   *     }
   *   }
   * }; */

  /* const uiSchema: UiSchema = {
  *   firstName: {
  *     'ui:autofocus': true
  *   },
  *   lastName: {
  *     'ui:autofocus': true
  *   }
  * };

  * const onSubmit = ({ formData }) => {
  *   console.log('Data submitted:', formData);
  * }; */

  return <div>Hello World! </div>;
};

export default SimplePreimagePage;

/* { <ProverDemoContainer
      title="Schema 1 Demo"
      description="This is a demonstration for Schema 1 proof generation."
      formComponent={
        <Form
          schema={schema}
          uiSchema={uiSchema}
          validate={validator}
          onSubmit={onSubmit}
        />
      }
      onAction={() => {}}
      actionLabel="Generate Proof"
      output=""
      //... rest of your props
    /> } */
