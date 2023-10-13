import { TaskEither } from 'fp-ts/TaskEither';

export type InterfaceKind = FpInterfaceType | TsInterfaceType;

export type FpInterfaceType = 'fp';
export const fpInterfaceTag: FpInterfaceType = 'fp';

export type TsInterfaceType = 'ts';
export const tsInterfaceTag: TsInterfaceType = 'ts';

export type ChooseType<
  InterfaceType extends InterfaceKind,
  FpType,
  TsType
> = InterfaceType extends FpInterfaceType
  ? FpType
  : InterfaceType extends TsInterfaceType
  ? TsType
  : never;

export type RetType<InterfaceType extends InterfaceKind, T> = ChooseType<
  InterfaceType,
  TaskEither<string, T>,
  Promise<T>
>;

export interface WithInterfaceTag<IType extends InterfaceKind> {
  readonly __interface_tag: IType;
}
