/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
/// <reference path="../.astro/components.d.ts" />


declare namespace App {
    interface Locals {
        lang: string,
        title: string,
        description: string,
        header: {
            [key: string]: string|object;
        },
        main: {
            [key: string]: string|object|object[]|string[]|object[][];
        },
        footer: {
            [key: string]: string|object;
        }
    }
}
