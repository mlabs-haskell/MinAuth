/* import React, { useState, useEffect } from 'react';
 * import Form, { IChangeEvent } from '@rjsf/core';
 * import { Field, Poseidon } from 'o1js';
 * import { JSONSchema7 } from 'json-schema';
 * import validator from '@rjsf/validator-ajv8';
 *
 * export { type IFormData, type IMyFormProps, type MyForm };
 *
 * const schema: JSONSchema7 = {
 *   title: 'Example Form',
 *   type: 'object',
 *   properties: {
 *     preimage: {
 *       type: 'string',
 *       title: 'Secret Preimage'
 *     },
 *     hash: {
 *       type: 'string',
 *       title: 'Hashed Value',
 *       readOnly: true
 *     }
 *   }
 * };
 *
 * interface IFormData {
 *   preimage: string;
 *   hash: string;
 * }
 *
 * // my form props
 * interface IMyFormProps {
 *   onFormSubmit: (formData: IFormData) => void;
 * }
 *
 * const MyForm = ({ onFormSubmit }: IMyFormProps) => {
 *   const [formData, setFormData] = useState<IFormData>({
 *     preimage: '',
 *     hash: ''
 *   });
 *
 *   useEffect(() => {
 *     const timer = setTimeout(() => {
 *       setFormData((formData) => ({
 *         ...formData,
 *         hash: Poseidon.hash([new Field(formData.preimage)]).toString()
 *       }));
 *     }, 300); // Update after a moment of inactivity
 *
 *     return () => clearTimeout(timer);
 *   }, [formData.preimage]);
 *
 *   const onChange = (e: IChangeEvent<IFormData>) => {
 *     // if form data is present then setFormData
 *     // else do nothing
 *     if (!e.formData) return;
 *     setFormData(e.formData);
 *   };
 *
 *   const onSubmit = (e: IChangeEvent<IFormData>) => {
 *     if (!e.formData) return;
 *     onFormSubmit(e.formData);
 *   };
 *
 *   return (
 *     <Form
 *       validator={validator}
 *       schema={schema}
 *       formData={formData}
 *       onChange={onChange}
 *       onSubmit={onSubmit}
 *     />
 *   );
 * };
 *
 * export default MyForm; */
